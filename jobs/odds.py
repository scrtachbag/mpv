"""Calcul des côtes "maison" à partir des points PCS.

Principe : la probabilité de victoire d'un coureur est supposée proportionnelle
à (points PCS) ** ALPHA. On normalise sur l'ensemble des partants, puis :

    côte = MARGIN / probabilité          (bornée entre ODDS_MIN et ODDS_MAX)

MARGIN > 1 simule la marge bookmaker (la somme des 1/côte dépasse 1). ALPHA
règle l'écart entre favoris et outsiders. Tous ces réglages sont dans config.py.

Ce ne sont pas les côtes Winamax, mais des côtes cohérentes, gratuites,
légales et 100 % automatiques.
"""
from __future__ import annotations

import config
from pcs import RiderEntry


def compute_odds(startlist: list[RiderEntry],
                 strength: dict[str, float]) -> list[dict]:
    """Renvoie [{rider_name, rider_pcs_id, odds}] pour chaque partant."""
    if not startlist:
        return []

    floor = config.ODDS_FLOOR_POINTS
    weights: list[float] = []
    for rider in startlist:
        pts = strength.get(rider.name, floor)
        pts = max(pts, floor)
        weights.append(pts ** config.ODDS_ALPHA)

    total = sum(weights) or 1.0
    out: list[dict] = []
    for rider, w in zip(startlist, weights):
        p = w / total
        odds = config.ODDS_MARGIN / p if p > 0 else config.ODDS_MAX
        odds = max(config.ODDS_MIN, min(config.ODDS_MAX, odds))
        out.append({
            "rider_name": rider.name,
            "rider_pcs_id": rider.pcs_id,
            "odds": round(odds, 2),
        })
    return out
