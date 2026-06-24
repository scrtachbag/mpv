"""Calcul des côtes "maison", dépendant de l'ÉTAPE et de la FORME du coureur.

Fonction PURE (aucun réseau) : se teste hors-ligne (voir tests/test_odds.py).

Force d'un coureur pour une étape donnée :
    force = FORM_WEIGHT × forme_récente  +  SPEC_WEIGHT × points_dans_la_spécialité_de_l'étape

Puis, comme avant :
    poids  = force ** ALPHA
    proba  = poids / Σ poids
    côte   = MARGIN / proba           (bornée [ODDS_MIN, ODDS_MAX])

Selon le profil de l'étape, la "spécialité pertinente" change : un sprinteur est
favori sur le plat, un grimpeur en montagne, un rouleur sur un contre-la-montre.
MARGIN > 1 simule la marge bookmaker ; ALPHA règle l'écart favoris/outsiders.
"""
from __future__ import annotations

import math

import config
from models import RiderForm

# Profil d'étape -> spécialité PCS pertinente. On teste par sous-chaîne (l'icône
# PCS peut être "flat", "mountainhard", "hilly", "itt", etc.).
PROFILE_RULES = [
    ("itt", "time_trial"), ("time_trial", "time_trial"), ("tt", "time_trial"),
    ("mountain", "climber"), ("mtn", "climber"), ("climb", "climber"),
    ("hill", "one_day"), ("cobble", "one_day"), ("punch", "one_day"),
    ("flat", "sprint"), ("sprint", "sprint"),
]


def specialty_for_profile(profile: str | None) -> str | None:
    if not profile:
        return None
    p = str(profile).lower()
    for needle, spec in PROFILE_RULES:
        if needle in p:
            return spec
    return None


def spec_points(rider: RiderForm, profile: str | None) -> float:
    """Points du coureur dans la spécialité pertinente pour le profil d'étape."""
    spec = specialty_for_profile(profile)
    if spec is not None:
        return float(rider.specialties.get(spec, 0.0))
    return max(rider.specialties.values(), default=0.0)  # profil inconnu : meilleure spé


def compute_odds(riders: list[RiderForm], profile: str | None,
                 *, alpha: float | None = None, form_bonus: float | None = None) -> list[dict]:
    """Renvoie [{rider_name, rider_pcs_id, odds}] pour chaque coureur.

    force = points_spécialité × (1 + form_bonus × forme/forme_max)
    poids = force ** alpha ; côte_brute = MARGIN / (poids/Σ).

    Les côtes brutes sont ensuite **compressées** (pas coupées) vers le plafond
    ODDS_MAX : on garde le favori comme ancre et on tasse la longue traîne des
    outsiders via une mise à l'échelle logarithmique (favori → favori,
    côte la plus haute → ODDS_MAX). L'écart entre coureurs est donc réduit de
    façon homogène, le 1er/2e inclus.
    """
    if not riders:
        return []
    alpha = config.ODDS_ALPHA if alpha is None else alpha
    form_bonus = config.ODDS_FORM_BONUS if form_bonus is None else form_bonus
    floor, cap = config.ODDS_MIN, config.ODDS_MAX
    max_form = max((float(r.form) for r in riders), default=0.0)

    weights = []
    for r in riders:
        base = max(spec_points(r, profile), config.ODDS_FLOOR_POINTS)
        fnorm = (float(r.form) / max_form) if max_form > 0 else 0.0
        strength = base * (1.0 + form_bonus * fnorm)
        weights.append(strength ** alpha)

    total = sum(weights) or 1.0
    raw = [max(config.ODDS_MARGIN / (w / total), floor) for w in weights]

    lo, hi = min(raw), max(raw)
    if hi > cap and hi > lo:
        # tasse [lo, hi] -> [lo, cap] en conservant l'ordre et les écarts relatifs
        k = math.log(cap / lo) / math.log(hi / lo)
        comp = [lo * (o / lo) ** k for o in raw]
    else:
        comp = raw

    return [{"rider_name": r.name, "rider_pcs_id": r.pcs_id,
             "odds": round(min(o, cap), 2),
             "nationality": r.nationality, "team": r.team}
            for r, o in zip(riders, comp)]
