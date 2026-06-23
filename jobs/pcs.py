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
import time
from datetime import date as _date

from procyclingstats import Stage, RaceStartlist, Rider

import config
from models import StageInfo, RiderEntry, RiderForm

log = logging.getLogger("mpv.pcs")

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


def _load_stage(slug: str, season: int, n: int) -> StageInfo | None:
    url = _stage_url(slug, season, n)
    try:
        st = Stage(url)
        date = _safe(st.date)
    except Exception as exc:  # noqa: BLE001
        log.debug("chargement étape %s échoué (%s)", url, exc)
        return None
    if not date:
        return None
    dep = _safe(st.departure)
    arr = _safe(st.arrival)
    name = f"{dep} → {arr}" if dep and arr else None
    profile = _normalize_profile(_safe(st.profile_icon), _safe(st.stage_type))
    return StageInfo(stage_no=n, date=str(date)[:10], name=name,
                     profile_type=profile, url=url)


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
        raw = RaceStartlist(url).startlist()
    except Exception as exc:  # noqa: BLE001
        log.warning("startlist indisponible (%s)", exc)
        return []
    out: list[RiderEntry] = []
    for r in raw or []:
        name = r.get("rider_name")
        if not name:
            continue
        out.append(RiderEntry(name=name.strip(), pcs_id=r.get("rider_url")))
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
    forms: list[RiderForm] = []
    for r in riders:
        spec: dict[str, float] = {}
        form = 0.0
        if r.pcs_id:
            try:
                rd = Rider(r.pcs_id)
                spec = _normalize_specialties(_safe(rd.points_per_speciality) or {})
                form = _season_form(rd, ref_date)   # forme pondérée par la récence
            except Exception as exc:  # noqa: BLE001
                log.warning("forme indisponible pour %s (%s)", r.name, exc)
        forms.append(RiderForm(name=r.name, pcs_id=r.pcs_id, form=form, specialties=spec))
        if sleep:
            time.sleep(sleep)
    log.info("forme/spécialités récupérées pour %d coureurs", len(forms))
    return forms


def get_results(stage_url: str, top_n: int) -> list[tuple[int, str]]:
    """Renvoie [(position, nom)] pour les `top_n` premiers, ou [] si l'étape
    n'a pas encore de résultat."""
    try:
        rows = Stage(stage_url).results()
    except Exception as exc:  # noqa: BLE001
        log.warning("résultats indisponibles (%s)", exc)
        return []
    out: list[tuple[int, str]] = []
    for r in rows or []:
        name = r.get("rider_name")
        rank = r.get("rank")
        if not name or rank in (None, "", "DNF", "DNS", "DSQ", "OTL"):
            continue
        try:
            pos = int(rank)
        except (TypeError, ValueError):
            continue
        out.append((pos, name.strip()))
        if len(out) >= top_n:
            break
    return out
