"""Cotes de MARCHÉ (favoris du book) depuis Unibet.

Unibet tourne sur la plateforme Kambi et expose une API JSON *ouverte* (pas
d'anti-bot depuis une IP résidentielle FR) : l'endpoint "live/topmarket" contient
le marché « Vainqueur » de l'étape courante/à venir du Tour de France hommes.
On en tire une liste classée (coureur, cote décimale) qui sert à CALIBRER nos
cotes maison sur le marché (cf. odds.blend_market).

Pur réseau : si Unibet est injoignable (hors FR, CI datacenter…), on renvoie une
liste vide et le modèle maison est utilisé tel quel (repli silencieux).
"""
from __future__ import annotations

import logging
import re
import unicodedata

import requests

log = logging.getLogger("mpv.market")

_URL = ("https://www.unibet.fr/services-api/sportsbookdata/current/events/"
        "live/topmarket?lineId=1&originId=3&includeEventsWithNoClock=true")
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Referer": "https://www.unibet.fr/paris-cyclisme",
}


def _price(v) -> float | None:
    try:
        return float(str(v).replace(",", "."))   # Unibet renvoie "2,75"
    except (TypeError, ValueError):
        return None


def get_stage_market(stage_no: int | None = None) -> tuple[str | None, list[tuple[str, float]]]:
    """Marché « Vainqueur » de l'étape TdF hommes courante/à venir.

    Renvoie (desc, [(coureur, cote), …] trié par cote croissante). Si `stage_no`
    est fourni, on exige que la description corresponde (« Etape 6 »). (None, [])
    si Unibet est injoignable ou aucun marché trouvé."""
    try:
        items = requests.get(_URL, headers=_HEADERS, timeout=25).json().get("items", {})
    except Exception as exc:  # noqa: BLE001 — réseau/JSON : repli sur le modèle
        log.warning("Marché Unibet indisponible (%s)", exc)
        return None, []

    for mid, mv in items.items():
        if not (isinstance(mv, dict) and mv.get("desc") == "Vainqueur"):
            continue
        ev = items.get(mv.get("parent"), {})
        league = (ev.get("path") or {}).get("League", "")
        if "tour de france" not in league.lower() or "(f)" in league.lower():
            continue  # on veut le Tour HOMMES
        desc = ev.get("desc", "")  # ex. "Etape 6"
        if stage_no is not None and f"tape {stage_no}" not in desc.lower():
            continue
        outs = [(v.get("desc"), _price(v.get("price"))) for v in items.values()
                if isinstance(v, dict) and v.get("parent") == mid and v.get("price")]
        outs = sorted([(n, o) for n, o in outs if n and o], key=lambda x: x[1])
        if outs:
            return desc, outs

    log.info("Aucun marché Unibet « Vainqueur » TdF hommes%s.",
             f" pour l'étape {stage_no}" if stage_no else "")
    return None, []


def _tokens(name: str) -> frozenset[str]:
    """Ensemble de jetons d'un nom, insensible à la casse/accents/ordre.
    'VAN DER POEL Mathieu' et 'Mathieu Van Der Poel' -> même ensemble."""
    s = unicodedata.normalize("NFD", name or "").encode("ascii", "ignore").decode()
    s = s.lower().replace(",", " ")
    return frozenset(t for t in re.split(r"[^a-z]+", s) if len(t) > 1)


def match(rider_names: list[str], market: list[tuple[str, float]]) -> dict[str, float]:
    """Associe chaque cote de marché à un `rider_name` des nôtres (par ensemble de
    jetons : égalité, sinon inclusion nom/prénom). Renvoie {rider_name: cote}."""
    by_tokens = {}
    for rn in rider_names:
        by_tokens.setdefault(_tokens(rn), rn)
    out: dict[str, float] = {}
    for mname, odds in market:
        mt = _tokens(mname)
        if not mt:
            continue
        hit = by_tokens.get(mt)
        if hit is None:
            for tk, rn in by_tokens.items():
                if mt <= tk or tk <= mt:   # inclusion (prénom manquant/ajouté)
                    hit = rn
                    break
        if hit is not None:
            out[hit] = odds
    return out
