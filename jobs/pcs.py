"""Accès aux données ProCyclingStats (PCS).

⚠️  C'est le SEUL module qui dépend de la librairie `procyclingstats`. Si une
    montée de version change un nom de méthode, c'est ici (et seulement ici)
    qu'il faut adapter. Tout est encapsulé derrière une petite interface stable :

        find_stage(season, slug, date|number) -> StageInfo | None
        get_startlist(season, slug)           -> list[RiderEntry]
        get_rider_forms(season, slug)         -> list[RiderForm]  (spécialités + forme)
        get_results(stage_url)                -> list[(position, name)]
"""
from __future__ import annotations
import logging
import math
import os
import time
from datetime import date as _date

import requests
from procyclingstats import Stage, RaceStartlist, Rider

import config
from models import StageInfo, RiderEntry, RiderForm

log = logging.getLogger("mpv.pcs")

# --- Accès HTTP à PCS (contournement Cloudflare) ----------------------------
# PCS est derrière Cloudflare, qui sert un "managed challenge" aux IP de
# datacenter (runners GitHub) -> 403. Stratégie RAPIDE : on résout le défi UNE
# fois via FlareSolverr (vrai navigateur), on récupère le cookie cf_clearance +
# le User-Agent, puis on charge les ~180 pages en HTTP DIRECT (comme avant, sans
# navigateur). Si le cookie est refusé/expiré, on le renouvelle et on réessaie.
# Sans MPV_FLARESOLVERR_URL (dev local, IP résidentielle) : requête directe.
_PCS_BASE = "https://www.procyclingstats.com/"
_FS_URL = os.environ.get("MPV_FLARESOLVERR_URL", "").strip()
_http = None  # requests.Session porteuse du cookie cf_clearance (voie rapide)

# API de scraping (ScraperAPI / ZenRows / Scrapfly…) : gère Cloudflare + IP
# résidentielles côté fournisseur — la seule voie fiable depuis une IP datacenter
# GitHub (FlareSolverr ne passe plus le défi Cloudflare de PCS depuis 2026-07).
# MPV_SCRAPER_API_URL = base AVEC la clé et les options anti-bot ; l'URL PCS
# cible est ajoutée en paramètre `url`. Exemples :
#   ScraperAPI : https://api.scraperapi.com/?api_key=XXX&ultra_premium=true
#   ZenRows    : https://api.zenrows.com/v1/?apikey=XXX&js_render=true&antibot=true
_SCRAPER_URL = os.environ.get("MPV_SCRAPER_API_URL", "").strip()


def _fs_post(cmd: str, **extra) -> dict:
    r = requests.post(_FS_URL, json={"cmd": cmd, **extra}, timeout=180)
    r.raise_for_status()
    return r.json()


def _abs(url: str) -> str:
    return url if url.startswith("http") else _PCS_BASE + url.lstrip("/")


def _renew_clearance() -> None:
    """Résout le défi Cloudflare via FlareSolverr et construit une session
    requests réutilisant le cookie cf_clearance + le même User-Agent. Une seule
    résolution navigateur ; ensuite tout passe en HTTP direct (rapide)."""
    global _http
    sol = _fs_post("request.get", url=_PCS_BASE, maxTimeout=90000).get("solution") or {}
    s = requests.Session()
    ua = sol.get("userAgent")
    if ua:
        s.headers["User-Agent"] = ua
    s.headers.setdefault("Accept-Language", "en-US,en;q=0.9")
    n = 0
    for c in sol.get("cookies", []):
        try:
            s.cookies.set(c.get("name"), c.get("value"), domain=c.get("domain"))
            n += 1
        except Exception:  # noqa: BLE001
            pass
    _http = s
    log.info("clearance Cloudflare obtenue (FlareSolverr) : %d cookies, UA=%s",
             n, (ua or "?")[:40])


def _fetch_html(url: str) -> str | None:
    """HTML d'une page PCS via la voie rapide (cookie cf_clearance en HTTP
    direct). Renouvelle le cookie via FlareSolverr si refusé. None si échec."""
    global _http
    for attempt in range(3):
        if _http is None:
            try:
                _renew_clearance()
            except Exception as exc:  # noqa: BLE001
                log.warning("FlareSolverr indisponible (%s)", exc)
                time.sleep(3)
                continue
        try:
            r = _http.get(_abs(url), timeout=30)
            if r.status_code == 200 and "Just a moment" not in r.text:
                return r.text
            log.warning("PCS %s -> HTTP %s (clearance refusée ? renouvellement)",
                        url, r.status_code)
        except Exception as exc:  # noqa: BLE001
            log.warning("échec requête %s (%s)", url, exc)
        _http = None  # force le renouvellement du cookie au tour suivant
        time.sleep(1)
    return None


def _fetch_via_scraper(url: str) -> str | None:
    """HTML d'une page PCS via l'API de scraping (contourne Cloudflare). L'URL
    PCS cible passe en paramètre `url` ; renvoie None après 3 échecs."""
    for attempt in range(3):
        try:
            r = requests.get(_SCRAPER_URL, params={"url": _abs(url)}, timeout=120)
            if r.status_code == 200 and "Just a moment" not in r.text:
                return r.text
            log.warning("scraper %s -> HTTP %s (tentative %d/3)", url, r.status_code, attempt + 1)
        except Exception as exc:  # noqa: BLE001
            log.warning("scraper échec %s (%s)", url, exc)
        time.sleep(2)
    return None


def _make(cls, url: str):
    """Instancie une classe procyclingstats. Via l'API de scraping ou FlareSolverr
    on fournit le HTML (update_html=False) ; sinon la lib fait sa requête directe
    (dev local, IP résidentielle)."""
    if _SCRAPER_URL:
        html = _fetch_via_scraper(url)
    elif _FS_URL:
        html = _fetch_html(url)
    else:
        return cls(url)
    if not html:
        raise ConnectionError(f"HTML PCS indisponible : {url}")
    return cls(url, html=html, update_html=False)

MAX_STAGES = 25  # garde-fou (le Tour compte 21 étapes)

# Clés de spécialité PCS -> clés canoniques utilisées par odds.py.
_SPEC_KEYS = {
    "sprint": "sprint",
    "climber": "climber", "climb": "climber",
    "gc": "gc",
    "time_trial": "time_trial", "tt": "time_trial",
    "one_day_races": "one_day", "one_day": "one_day", "hills": "one_day", "classic": "one_day",
}

# Codes profil PCS (profile_icon) -> profil canonique (mots compris par odds.py).
_PROFILE_ICON = {"p1": "flat", "p2": "hilly", "p3": "hilly", "p4": "mountain", "p5": "mountain"}


def _normalize_profile(icon, stype) -> str | None:
    """Combine profile_icon (p1..p5) et stage_type pour donner un profil
    canonique : 'itt' / 'flat' / 'hilly' / 'mountain'."""
    s = str(stype or "").lower()
    if any(k in s for k in ("itt", "ttt", "time trial", "chrono", " tt", "tt ")):
        return "itt"
    key = str(icon or "").lower().strip()
    if key in _PROFILE_ICON:
        return _PROFILE_ICON[key]
    return s or (str(icon) if icon else None)


def _safe(fn, default=None):
    try:
        return fn()
    except Exception:  # noqa: BLE001 — la lib lève des erreurs variées
        return default


def _stage_url(slug: str, season: int, n: int) -> str:
    return f"race/{slug}/{season}/stage-{n}"


def _parse_start_time(raw) -> str | None:
    """Normalise l'heure de départ PCS ('13:05 ', '13:05 (13:05 CEST)') -> 'HH:MM'."""
    if not raw:
        return None
    head = str(raw).strip().split()
    parts = (head[0] if head else "").split(":")
    if len(parts) >= 2 and parts[0].isdigit() and parts[1][:2].isdigit():
        return f"{int(parts[0]):02d}:{parts[1][:2]}"
    return None


def _load_stage(slug: str, season: int, n: int) -> StageInfo | None:
    url = _stage_url(slug, season, n)
    try:
        st = _make(Stage, url)
    except Exception as exc:  # noqa: BLE001
        # WARNING (pas DEBUG) : sinon la vraie cause (ex. 403 Cloudflare depuis
        # un runner CI) reste invisible et on ne voit que « introuvable ».
        log.warning("chargement étape %s échoué (%s)", url, exc)
        return None
    date = _safe(st.date)
    if not date:
        return None
    dep = _safe(st.departure)
    arr = _safe(st.arrival)
    name = f"{dep} → {arr}" if dep and arr else None
    profile = _normalize_profile(_safe(st.profile_icon), _safe(st.stage_type))
    start = _parse_start_time(_safe(st.start_time))
    return StageInfo(stage_no=n, date=str(date)[:10], name=name,
                     profile_type=profile, url=url, start_time=start)


def find_stage(season: int, slug: str, *, date: str | None = None,
               number: int | None = None) -> StageInfo | None:
    """Trouve une étape par numéro, ou par date (par défaut la plus récente
    dont la date correspond)."""
    if number is not None:
        return _load_stage(slug, season, number)
    for n in range(1, MAX_STAGES + 1):
        info = _load_stage(slug, season, n)
        if info is None:
            break  # plus d'étape publiée au-delà
        if date is not None and info.date == date:
            return info
    return None


def get_startlist(season: int, slug: str) -> list[RiderEntry]:
    url = f"race/{slug}/{season}/startlist"
    try:
        raw = _make(RaceStartlist, url).startlist()
    except Exception as exc:  # noqa: BLE001
        log.warning("startlist indisponible (%s)", exc)
        return []
    out: list[RiderEntry] = []
    for r in raw or []:
        name = r.get("rider_name")
        if not name:
            continue
        nat = r.get("nationality") or r.get("rider_nationality") or r.get("flag")
        out.append(RiderEntry(
            name=name.strip(), pcs_id=r.get("rider_url"),
            nationality=(str(nat).strip().lower() if nat else None),
            team=(r.get("team_name") or r.get("team") or None),
        ))
    return out


def _normalize_specialties(raw: dict) -> dict:
    out: dict[str, float] = {}
    for k, v in (raw or {}).items():
        key = _SPEC_KEYS.get(str(k).lower())
        if key is None:
            continue
        try:
            out[key] = out.get(key, 0.0) + float(v)
        except (TypeError, ValueError):
            pass
    return out


def _season_form(rider, ref_date: _date) -> float:
    """Forme récente pondérée par la récence : Σ pcs_points × exp(-jours/TAU),
    avec jours = nb de jours entre la course et `ref_date` (date de l'étape).
    Les résultats récents (Tour de Suisse, étapes du Tour déjà courues) pèsent
    donc beaucoup plus que les courses de début de saison. 0.0 si inactif."""
    rows = _safe(rider.season_results)
    if not isinstance(rows, list):
        return 0.0
    tau = config.ODDS_FORM_TAU_DAYS or 30.0
    total = 0.0
    for r in rows:
        if not isinstance(r, dict):
            continue
        pts = r.get("pcs_points") or r.get("points")
        if not isinstance(pts, (int, float)) or pts <= 0:
            continue
        raw = r.get("date")
        weight = config.ODDS_FORM_UNDATED_WEIGHT
        if raw:
            try:
                d = _date.fromisoformat(str(raw)[:10])
                days = max((ref_date - d).days, 0)
                weight = math.exp(-days / tau)
            except ValueError:
                pass
        total += float(pts) * weight
    return total


def get_rider_forms(season: int, slug: str, *, ref_date: _date | None = None,
                    sleep: float = 0.0, limit: int | None = None) -> list[RiderForm]:
    """Pour chaque partant : points par spécialité + forme récente pondérée.

    `ref_date` = date de l'étape (la récence est mesurée par rapport à elle).
    ⚠️ Une requête PCS par coureur (~180/jour) — politesse via `sleep`.
    """
    if ref_date is None:
        from datetime import datetime
        ref_date = datetime.now(config.TZ).date()
    riders = get_startlist(season, slug)
    if limit:
        riders = riders[:limit]
    total = len(riders)
    log.info("récupération forme/spécialités pour %d coureurs "
             "(1 page PCS/coureur ; via FlareSolverr, plusieurs minutes)…", total)
    forms: list[RiderForm] = []
    for i, r in enumerate(riders, 1):
        spec: dict[str, float] = {}
        form = 0.0
        if r.pcs_id:
            try:
                rd = _make(Rider, r.pcs_id)
                spec = _normalize_specialties(_safe(rd.points_per_speciality) or {})
                form = _season_form(rd, ref_date)   # forme pondérée par la récence
            except Exception as exc:  # noqa: BLE001
                log.warning("forme indisponible pour %s (%s)", r.name, exc)
        forms.append(RiderForm(name=r.name, pcs_id=r.pcs_id, form=form, specialties=spec,
                               nationality=r.nationality, team=r.team))
        if i % 20 == 0 or i == total:
            log.info("… %d/%d coureurs traités", i, total)
        if sleep:
            time.sleep(sleep)
    log.info("forme/spécialités récupérées pour %d coureurs", len(forms))
    return forms


def get_results(stage_url: str, top_n: int) -> list[tuple[int, str]]:
    """Renvoie [(position, nom)] pour les `top_n` premiers, ou [] si l'étape
    n'a pas encore de résultat."""
    try:
        rows = _make(Stage, stage_url).results()
    except Exception as exc:  # noqa: BLE001
        log.warning("résultats indisponibles (%s)", exc)
        return []
    out: list[tuple[int, str]] = []
    seen: set[int] = set()   # une seule ligne par position (évite les doublons
    for r in rows or []:     # de classements annexes concaténés / ex-aequo -> 500 upsert)
        name = r.get("rider_name")
        rank = r.get("rank")
        if not name or rank in (None, "", "DNF", "DNS", "DSQ", "OTL"):
            continue
        try:
            pos = int(rank)
        except (TypeError, ValueError):
            continue
        if pos in seen:
            continue
        seen.add(pos)
        out.append((pos, name.strip()))
        if len(out) >= top_n:
            break
    return out
