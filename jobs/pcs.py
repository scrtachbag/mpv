"""Accès aux données ProCyclingStats (PCS).

⚠️  C'est le SEUL module qui dépend de la librairie `procyclingstats`. Si une
    montée de version change un nom de méthode, c'est ici (et seulement ici)
    qu'il faut adapter. Tout est encapsulé derrière une petite interface stable :

        find_stage(season, slug, date|number) -> StageInfo | None
        get_startlist(season, slug)           -> list[Rider]
        get_strength_map(season)              -> dict[name -> float]
        get_results(stage_url)                -> list[(position, name)]
"""
from __future__ import annotations
from dataclasses import dataclass
import logging

from procyclingstats import Stage, RaceStartlist, Ranking

log = logging.getLogger("mpv.pcs")

MAX_STAGES = 25  # garde-fou (le Tour compte 21 étapes)


@dataclass
class StageInfo:
    stage_no: int
    date: str          # "YYYY-MM-DD"
    name: str | None
    profile_type: str | None
    url: str


@dataclass
class RiderEntry:
    name: str
    pcs_id: str | None


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
    except Exception:  # noqa: BLE001
        return None
    if not date:
        return None
    dep = _safe(st.departure)
    arr = _safe(st.arrival)
    name = f"{dep} → {arr}" if dep and arr else None
    profile = _safe(st.profile_icon) or _safe(st.stage_type)
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


def get_strength_map(season: int) -> dict[str, float]:
    """Renvoie {nom_coureur: points_PCS}. Sert de proxy de "force" pour les
    côtes. En cas d'échec, renvoie {} (les côtes seront alors uniformes)."""
    candidates = [
        f"rankings/{season}/me/individual",
        "rankings/me/individual",
    ]
    for url in candidates:
        try:
            rk = Ranking(url)
        except Exception:  # noqa: BLE001
            continue
        rows = (_safe(rk.individual_ranking)
                or _safe(rk.ranking)
                or _safe(lambda: rk.parse().get("individual_ranking"))
                or [])
        out: dict[str, float] = {}
        for row in rows:
            name = row.get("rider_name")
            pts = row.get("points")
            if not name:
                continue
            try:
                out[name.strip()] = float(pts)
            except (TypeError, ValueError):
                continue
        if out:
            log.info("classement PCS : %d coureurs cotés", len(out))
            return out
    log.warning("classement PCS indisponible : côtes uniformes")
    return {}


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
