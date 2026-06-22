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


def rider_strength(rider: RiderForm, profile: str | None) -> float:
    spec = specialty_for_profile(profile)
    if spec is not None:
        spec_points = float(rider.specialties.get(spec, 0.0))
    else:
        # Profil inconnu : on prend la meilleure spécialité du coureur.
        spec_points = max(rider.specialties.values(), default=0.0)
    strength = config.ODDS_FORM_WEIGHT * float(rider.form) + config.ODDS_SPEC_WEIGHT * spec_points
    return max(strength, config.ODDS_FLOOR_POINTS)


def compute_odds(riders: list[RiderForm], profile: str | None) -> list[dict]:
    """Renvoie [{rider_name, rider_pcs_id, odds}] pour chaque coureur."""
    if not riders:
        return []
    weights = [rider_strength(r, profile) ** config.ODDS_ALPHA for r in riders]
    total = sum(weights) or 1.0
    out: list[dict] = []
    for r, w in zip(riders, weights):
        p = w / total
        odds = config.ODDS_MARGIN / p if p > 0 else config.ODDS_MAX
        odds = max(config.ODDS_MIN, min(config.ODDS_MAX, odds))
        out.append({"rider_name": r.name, "rider_pcs_id": r.pcs_id, "odds": round(odds, 2)})
    return out
