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


def spec_points(rider: RiderForm, profile: str | None) -> float:
    """Points du coureur dans la spécialité pertinente pour le profil d'étape.

    Cas "hilly" (one_day) : on ajoute une part des points de grimpeur, car une
    arrivée en bosse peut se jouer entre grimpeurs (Mûr-de-Bretagne…), pas
    seulement entre puncheurs/classicmen."""
    spec = specialty_for_profile(profile)
    if spec is None:
        return max(rider.specialties.values(), default=0.0)  # profil inconnu : meilleure spé
    pts = float(rider.specialties.get(spec, 0.0))
    if spec == "one_day" and config.ODDS_HILLY_CLIMBER > 0:
        pts += config.ODDS_HILLY_CLIMBER * float(rider.specialties.get("climber", 0.0))
    return pts


def compute_odds(riders: list[RiderForm], profile: str | None,
                 *, alpha: float | None = None, form_bonus: float | None = None) -> list[dict]:
    """Renvoie [{rider_name, rider_pcs_id, odds}] pour chaque coureur.

    force = points_spécialité × (1 + form_bonus × forme/forme_max)
    poids = force ** alpha ; côte_brute = MARGIN / (poids/Σ).

    Les côtes sont bornées [ODDS_MIN, ODDS_MAX] par un **plafond dur** : on coupe
    simplement à ODDS_MAX, sans recalculer/compresser les côtes inférieures.
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
    return [{"rider_name": r.name, "rider_pcs_id": r.pcs_id,
             "odds": round(min(max(config.ODDS_MARGIN / (w / total), floor), cap), 2),
             "nationality": r.nationality, "team": r.team}
            for r, w in zip(riders, weights)]


def blend_market(rows: list[dict], market_by_name: dict[str, float],
                 weight: float | None = None) -> list[dict]:
    """Rapproche nos côtes de celles du MARCHÉ (cf. market.py).

    On mélange les probabilités implicites : p = weight·p_marché + (1−weight)·p_maison,
    puis côte = MARGIN / p (bornée). Les favoris du book se raccourcissent, les
    coureurs qu'il ne cote pas s'allongent, et CHAQUE coureur garde une côte
    cohérente. weight<=0 ou marché vide -> `rows` inchangé (repli sur le modèle).

    Fonction PURE (aucun réseau) : testable hors-ligne."""
    weight = config.ODDS_MARKET_WEIGHT if weight is None else weight
    if not rows or not market_by_name or weight <= 0:
        return rows
    weight = min(max(weight, 0.0), 1.0)
    margin, floor, cap = config.ODDS_MARGIN, config.ODDS_MIN, config.ODDS_MAX

    inv = {r["rider_name"]: 1.0 / max(r["odds"], 1e-9) for r in rows}
    tot_model = sum(inv.values()) or 1.0
    p_model = {k: v / tot_model for k, v in inv.items()}

    mk = {n: 1.0 / max(o, 1e-9) for n, o in market_by_name.items() if n in p_model}
    tot_mkt = sum(mk.values()) or 1.0
    p_mkt = {k: v / tot_mkt for k, v in mk.items()}

    out = []
    for r in rows:
        p = weight * p_mkt.get(r["rider_name"], 0.0) + (1.0 - weight) * p_model[r["rider_name"]]
        odds = round(min(max(margin / max(p, 1e-12), floor), cap), 2)
        out.append({**r, "odds": odds})
    return out
