"""Mode BÊTA : rejouer de vraies étapes (ex. Tour 2025) « comme aujourd'hui »
pour tester l'appli avec des amis, puis repartir d'une base propre.

  python beta.py open  --stage 12 [--season 2025] [--hours 48]
      -> calcule les VRAIES côtes 2025 de l'étape, l'affiche comme "étape du
         jour", paris ouverts pendant `hours` heures.

  python beta.py close --stage 12 [--season 2025]
      -> charge les VRAIS résultats 2025 + verrouille les paris -> scoring.

  python beta.py reset
      -> efface étapes / côtes / paris / résultats / messages (GARDE les comptes).

Pilotable en 1 clic via le workflow GitHub « Bêta (étapes 2025) ».
"""
import argparse
import logging
from datetime import datetime, timedelta

import config
import odds
import supabase_client as db

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mpv.beta")


def _now():
    return datetime.now(config.TZ)


def cmd_open(season, slug, stage_no, hours):
    import pcs
    info = pcs.find_stage(season, slug, number=stage_no)
    if info is None:
        log.error("Étape %s introuvable pour %s %s.", stage_no, slug, season)
        return 1

    forms = pcs.get_rider_forms(season, slug)   # forme = saison en cours (réelle)
    rows = odds.compute_odds(forms, info.profile_type)
    if not rows:
        log.error("Impossible de coter (startlist vide ?).")
        return 1

    today = _now().date().isoformat()
    deadline = (_now() + timedelta(hours=hours)).isoformat()
    stage_id = db.upsert_stage({
        "season": season, "stage_no": stage_no,
        "label": f"[Bêta] Étape {stage_no}", "name": info.name,
        "profile_type": info.profile_type, "date": today,
        "bet_deadline": deadline, "odds_status": "published", "results_status": "pending",
    })
    for r in rows:
        r["stage_id"] = stage_id
    db.delete("stage_results", {"stage_id": stage_id})   # repart propre si ré-ouverture
    db.delete("stage_riders", {"stage_id": stage_id})
    db.upsert("stage_riders", rows, on_conflict="stage_id,rider_name")
    db.update("stages", {"id": stage_id},
              {"date": today, "bet_deadline": deadline,
               "odds_status": "published", "results_status": "pending"})

    fav = sorted(rows, key=lambda x: x["odds"])[:5]
    log.info("Étape %s ouverte (béta) — paris jusqu'à %s. Favoris : %s",
             stage_no, deadline, ", ".join(f"{r['rider_name']} ({r['odds']})" for r in fav))
    return 0


def cmd_close(season, slug, stage_no):
    import pcs
    found = db.select("stages", {"season": f"eq.{season}", "stage_no": f"eq.{stage_no}",
                                 "select": "id"})
    if not found:
        log.error("Étape %s non ouverte en base.", stage_no)
        return 1
    stage_id = found[0]["id"]
    info = pcs.find_stage(season, slug, number=stage_no)
    results = pcs.get_results(info.url, config.RESULTS_TOP_N)
    if not results:
        log.error("Pas encore de résultats pour l'étape %s.", stage_no)
        return 1

    rows = [{"stage_id": stage_id, "position": p, "rider_name": n} for p, n in results]
    db.delete("stage_results", {"stage_id": stage_id})
    db.upsert("stage_results", rows, on_conflict="stage_id,position")
    past = (_now() - timedelta(minutes=1)).isoformat()
    db.update("stages", {"id": stage_id},
              {"results_status": "official", "bet_deadline": past})

    podium = ", ".join(f"{p}. {n}" for p, n in results[:3])
    log.info("Étape %s clôturée + résultats (%d positions). Podium : %s",
             stage_no, len(rows), podium)
    return 0


def cmd_reset():
    db.delete_all("messages")
    db.delete_all("stages")   # cascade -> stage_riders, stage_results, bets
    log.info("Base de jeu remise à zéro (étapes, côtes, paris, résultats, messages). "
             "Les comptes sont conservés.")
    return 0


def main() -> int:
    config.require_supabase()
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="action", required=True)

    p_open = sub.add_parser("open")
    p_open.add_argument("--stage", type=int, required=True)
    p_open.add_argument("--season", type=int, default=2025)
    p_open.add_argument("--slug", default=config.RACE_SLUG)
    p_open.add_argument("--hours", type=float, default=48.0)

    p_close = sub.add_parser("close")
    p_close.add_argument("--stage", type=int, required=True)
    p_close.add_argument("--season", type=int, default=2025)
    p_close.add_argument("--slug", default=config.RACE_SLUG)

    sub.add_parser("reset")

    args = ap.parse_args()
    if args.action == "open":
        return cmd_open(args.season, args.slug, args.stage, args.hours)
    if args.action == "close":
        return cmd_close(args.season, args.slug, args.stage)
    if args.action == "reset":
        return cmd_reset()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
