"""Cotes de MARCHÉ (favoris du book) depuis Unibet.

Unibet tourne sur la plateforme Kambi et expose une API JSON. Deux cas :
  - étape IMMINENTE (courante/prochaine) : endpoint "live/topmarket", ouvert en
    requête simple (pas d'anti-bot depuis une IP résidentielle FR) ;
  - étape À VENIR (ex. demain soir alors que l'étape du jour court encore) :
    l'endpoint next/{groupe} exige la session du navigateur (401 en requête
    simple) -> on le récupère via Playwright (fallback), en navigant sur le hub.

On renvoie le marché « Vainqueur » de l'étape TdF hommes visée : une liste
classée (coureur, cote décimale) qui sert à CALIBRER nos cotes maison sur le
marché (cf. odds.blend_market). Repli silencieux (liste vide) si tout échoue.
"""
from __future__ import annotations

import json
import logging
import re
import unicodedata

import requests

log = logging.getLogger("mpv.market")

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
_HEADERS = {"User-Agent": _UA, "Accept": "application/json, text/plain, */*",
            "Accept-Language": "fr-FR,fr;q=0.9", "Referer": "https://www.unibet.fr/paris-cyclisme"}
_LIVE_URL = ("https://www.unibet.fr/services-api/sportsbookdata/current/events/"
             "live/topmarket?lineId=1&originId=3&includeEventsWithNoClock=true")
_HUB_URL = "https://www.unibet.fr/paris-cyclisme/international/tour-de-france"


def _price(v) -> float | None:
    try:
        return float(str(v).replace(",", "."))   # Unibet renvoie "2,75"
    except (TypeError, ValueError):
        return None


def _fetch_live_items() -> dict:
    """Événements imminents (étape courante/prochaine) — requête simple."""
    try:
        return requests.get(_LIVE_URL, headers=_HEADERS, timeout=25).json().get("items", {})
    except Exception as exc:  # noqa: BLE001 — réseau/JSON : repli
        log.warning("Marché Unibet (live) indisponible (%s)", exc)
        return {}


def _fetch_upcoming_items() -> dict:
    """Étapes À VENIR via Playwright : on navigue sur le hub TdF hommes et on
    capture la réponse lvs-api/next (qui refuse les requêtes simples). {} si
    Playwright est absent ou échoue (on retombe alors sur le modèle maison)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log.info("Playwright absent : pas de marché pour les étapes non imminentes.")
        return {}
    bodies: list[str] = []
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(headless=True,
                                   args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
            pg = br.new_context(locale="fr-FR", user_agent=_UA,
                                viewport={"width": 1366, "height": 900}).new_page()

            def on_resp(r):
                try:
                    if "lvs-api/next" in r.url and "json" in r.headers.get("content-type", ""):
                        bodies.append(r.text())
                except Exception:  # noqa: BLE001
                    pass

            pg.on("response", on_resp)
            pg.goto(_HUB_URL, wait_until="domcontentloaded", timeout=45000)
            pg.wait_for_timeout(8000)
            br.close()
    except Exception as exc:  # noqa: BLE001
        log.warning("Navigateur Unibet indisponible (%s)", exc)
        return {}
    items: dict = {}
    for b in bodies:
        try:
            items.update(json.loads(b).get("items", {}))
        except Exception:  # noqa: BLE001
            pass
    return items


def _parse_market(items: dict, stage_no: int | None) -> tuple[str | None, list[tuple[str, float]]]:
    """Extrait le marché « Vainqueur » TdF hommes des `items` (schéma plat Kambi :
    marché m -> événement parent -> issues o avec desc+price)."""
    for mid, mv in items.items():
        if not (isinstance(mv, dict) and mv.get("desc") == "Vainqueur"):
            continue
        ev = items.get(mv.get("parent"), {})
        league = (ev.get("path") or {}).get("League", "")
        if "tour de france" not in league.lower() or "(f)" in league.lower():
            continue  # on veut le Tour HOMMES
        desc = ev.get("desc", "")  # ex. "Etape 7"
        if stage_no is not None and f"tape {stage_no}" not in desc.lower():
            continue
        outs = [(v.get("desc"), _price(v.get("price"))) for v in items.values()
                if isinstance(v, dict) and v.get("parent") == mid and v.get("price")]
        outs = sorted([(n, o) for n, o in outs if n and o], key=lambda x: x[1])
        if outs:
            return desc, outs
    return None, []


def get_stage_market(stage_no: int | None = None) -> tuple[str | None, list[tuple[str, float]]]:
    """Marché « Vainqueur » de l'étape TdF hommes visée (ou la prochaine si
    `stage_no` est None). D'abord le live (imminent, requête simple), sinon les
    étapes à venir via navigateur. (None, []) si rien de trouvé."""
    desc, outs = _parse_market(_fetch_live_items(), stage_no)
    if outs:
        return desc, outs
    desc, outs = _parse_market(_fetch_upcoming_items(), stage_no)
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
                if mt <= tk or tk <= mt:
                    hit = rn
                    break
        if hit is not None:
            out[hit] = odds
    return out
