"""Tests du calcul des côtes — déterministes, SANS réseau ni PCS.

    python tests/test_odds.py        (ou : pytest jobs/tests)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import RiderForm
import odds


def riders():
    return [
        RiderForm("Sprinteur",  "r/s", form=60, specialties={"sprint": 400, "climber": 10, "time_trial": 30}),
        RiderForm("Grimpeur",   "r/g", form=60, specialties={"sprint": 10, "climber": 400, "time_trial": 40}),
        RiderForm("Rouleur",    "r/t", form=50, specialties={"sprint": 60, "climber": 60, "time_trial": 380}),
        RiderForm("Puncheur",   "r/p", form=55, specialties={"one_day": 350, "sprint": 120, "climber": 90}),
        RiderForm("Domestique", "r/d", form=5,  specialties={}),
    ]


def odds_map(profile):
    return {o["rider_name"]: o["odds"] for o in odds.compute_odds(riders(), profile)}


def test_sprinteur_favori_sur_plat():
    m = odds_map("flat")
    assert m["Sprinteur"] < m["Grimpeur"]
    assert m["Sprinteur"] < m["Rouleur"]


def test_grimpeur_favori_en_montagne():
    m = odds_map("mountainhard")
    assert m["Grimpeur"] < m["Sprinteur"]
    assert m["Grimpeur"] < m["Rouleur"]


def test_rouleur_favori_sur_clm():
    m = odds_map("itt")
    assert m["Rouleur"] < m["Sprinteur"]
    assert m["Rouleur"] < m["Grimpeur"]


def test_puncheur_favori_sur_vallonnee():
    m = odds_map("hilly")
    assert m["Puncheur"] < m["Sprinteur"]
    assert m["Puncheur"] < m["Grimpeur"]


def test_domestique_est_un_outsider():
    m = odds_map("flat")
    assert m["Domestique"] > m["Sprinteur"]


def test_cotes_dans_les_bornes():
    for o in odds.compute_odds(riders(), "flat"):
        assert 1.5 <= o["odds"] <= 500


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print("OK", t.__name__)
    print(f"\n{len(tests)} tests passent.")
    # Aperçu des côtes par profil
    for prof in ("flat", "mountainhard", "itt", "hilly"):
        favs = sorted(odds.compute_odds(riders(), prof), key=lambda x: x["odds"])
        print(f"\n{prof:12} ->", ", ".join(f"{o['rider_name']} {o['odds']}" for o in favs))
