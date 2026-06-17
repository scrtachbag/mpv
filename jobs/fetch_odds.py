"""Job du matin : publie l'étape du jour + les côtes des partants.

À lancer chaque matin (avant 12h00) pendant le Tour, via un pipeline planifié
GitLab. Les paris se ferment à BET_HOUR (12h00 heure de Paris).

Usage :
    python fetch_odds.py                 # étape dont la date == aujourd'hui
    python fetch_odds.py --stage 5       # force l'étape n°5
    python fetch_odds.py --date 2026-07-04
"""
import argparse
import logging
from datetime import datetime, time

import config
import pcs
import odds
import supabase_client as db

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mpv.odds")


def _deadline_iso(date_str: str) -> str:
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    dt = datetime.combine(d, time(hour=config.BET_HOUR), tzinfo=config.TZ)
    return dt.isoformat()


def main() -> int:
    config.require_supabase()
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", type=int, help="numéro d'étape à forcer")
    ap.add_argument("--date", help="date d'étape YYYY-MM-DD (défaut : aujourd'hui)")
    args = ap.parse_args()

    today = args.date or datetime.now(config.TZ).date().isoformat()
    info = pcs.find_stage(config.SEASON, config.RACE_SLUG,
                          date=None if args.stage else today,
                          number=args.stage)
    if info is None:
        log.info("Aucune étape pour %s (jour de repos / hors Tour). Rien à faire.", today)
        return 0

    log.info("Étape %s du %s : %s", info.stage_no, info.date, info.name or "?")

    stage_id = db.upsert_stage({
        "season": config.SEASON,
        "stage_no": info.stage_no,
        "label": f"Étape {info.stage_no}",
        "name": info.name,
        "profile_type": info.profile_type,
        "date": info.date,
        "bet_deadline": _deadline_iso(info.date),
        "odds_status": "pending",
    })

    startlist = pcs.get_startlist(config.SEASON, config.RACE_SLUG)
    if not startlist:
        log.error("Startlist vide : impossible de coter l'étape.")
        return 1
    strength = pcs.get_strength_map(config.SEASON)
    rows = odds.compute_odds(startlist, strength)
    for r in rows:
        r["stage_id"] = stage_id

    # On remplace proprement les côtes de l'étape (gère les abandons).
    db.delete("stage_riders", {"stage_id": stage_id})
    db.upsert("stage_riders", rows, on_conflict="stage_id,rider_name")
    db.update("stages", {"id": stage_id}, {"odds_status": "published"})

    fav = sorted(rows, key=lambda x: x["odds"])[:5]
    log.info("%d coureurs cotés. Favoris : %s", len(rows),
             ", ".join(f"{r['rider_name']} ({r['odds']})" for r in fav))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
