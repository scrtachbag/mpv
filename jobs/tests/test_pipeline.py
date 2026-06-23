"""Tests de régression sur de VRAIES captures PCS (Tour 2025), hors-ligne.

Vérifie que le bon profil ressort selon le type d'étape. Données figées dans
tests/fixtures (capturées via `fetch_odds.py --save-snapshot`).

    python tests/test_pipeline.py     (ou : pytest jobs/tests)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import RiderForm
import odds

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def odds_map(filename):
    d = json.load(open(os.path.join(FIX, filename), encoding="utf-8"))
    rows = odds.compute_odds([RiderForm.from_json(r) for r in d["riders"]], d["profile"])
    return {o["rider_name"]: o["odds"] for o in rows}, d["profile"]


def cote(m, needle):
    for name, o in m.items():
        if needle in name.upper():
            return o
    raise AssertionError(f"{needle} introuvable dans la capture")


def test_montagne_favorise_grimpeurs():
    m, prof = odds_map("tdf2025_stage12_mountain.json")
    assert prof == "mountain"
    assert cote(m, "POGA") < cote(m, "DÉMARE")        # grimpeur ≪ sprinteur
    assert cote(m, "VINGEGAARD") < cote(m, "PHILIPSEN")
    # Le vrai vainqueur (Pogačar) est l'archi-favori.
    assert cote(m, "POGA") == min(m.values())


def test_plat_favorise_sprinteurs():
    m, prof = odds_map("tdf2025_stage1_flat.json")
    assert prof == "flat"
    assert cote(m, "PHILIPSEN") < cote(m, "VINGEGAARD")
    assert cote(m, "MERLIER") < cote(m, "POGA")       # sprinteur ≪ grimpeur sur le plat


def test_clm_favorise_rouleurs():
    m, prof = odds_map("tdf2025_stage5_itt.json")
    assert prof == "itt"
    assert cote(m, "EVENEPOEL") < cote(m, "MERLIER")  # rouleur ≪ sprinteur
    assert cote(m, "GANNA") < cote(m, "PHILIPSEN")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for t in tests:
        t()
        print("OK", t.__name__)
    print(f"\n{len(tests)} tests de régression passent.")
