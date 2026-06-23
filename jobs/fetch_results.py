"""Job du soir : récupère les résultats de l'étape et fige le score.

Le classement est une vue Postgres calculée en direct : dès que les résultats
sont enregistrés, les points et le classement se mettent à jour. Aucun "recalcul"
séparé n'est nécessaire.

À lancer chaque soir pendant le Tour (pipeline planifié), et/ou à la demande de
l'admin (pipeline manuel / bouton dans l'appli).

Usage :
    python fetch_results.py              # étape dont la date == aujourd'hui
    python fetch_results.py --stage 5
    python fetch_results.py --date 2026-07-04
"""
import argparse
import logging
from datetime import datetime

import config
import pcs
import supabase_client as db

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mpv.results")


def main() -> int:
    config.require_supabase()
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", type=int, help="numéro d'étape à forcer")
    ap.add_argument("--date", help="date d'étape YYYY-MM-DD (défaut : aujourd'hui)")
    ap.add_argument("--season", type=int, help=f"saison (défaut: {config.SEASON})")
    ap.add_argument("--slug", help=f"course PCS (défaut: {config.RACE_SLUG})")
    args = ap.parse_args()
    season = args.season or config.SEASON
    slug = args.slug or config.RACE_SLUG

    today = args.date or datetime.now(config.TZ).date().isoformat()
    info = pcs.find_stage(season, slug,
                          date=None if args.stage else today,
                          number=args.stage)
    if info is None:
        if args.stage:
            log.warning("Étape %s introuvable pour %s %s.", args.stage, slug, season)
        else:
            log.info("Aucune étape datée du %s pour %s %s. Rien à faire.", today, slug, season)
        return 0

    # L'étape doit déjà exister (créée par le job du matin).
    found = db.select("stages", {
        "season": f"eq.{season}",
        "stage_no": f"eq.{info.stage_no}",
        "select": "id",
    })
    if not found:
        log.warning("Étape %s absente en base (job du matin non passé ?).", info.stage_no)
        stage_id = db.upsert_stage({
            "season": season, "stage_no": info.stage_no,
            "label": f"Étape {info.stage_no}", "name": info.name,
            "profile_type": info.profile_type, "date": info.date,
            "bet_deadline": f"{info.date}T12:00:00+02:00",
        })
    else:
        stage_id = found[0]["id"]

    results = pcs.get_results(info.url, config.RESULTS_TOP_N)
    if not results:
        log.info("Résultats pas encore disponibles pour l'étape %s.", info.stage_no)
        return 0

    rows = [{"stage_id": stage_id, "position": pos, "rider_name": name}
            for pos, name in results]
    db.delete("stage_results", {"stage_id": stage_id})
    db.upsert("stage_results", rows, on_conflict="stage_id,position")
    db.update("stages", {"id": stage_id}, {"results_status": "official"})

    podium = ", ".join(f"{pos}. {name}" for pos, name in results[:3])
    log.info("Étape %s enregistrée (%d positions). Podium : %s",
             info.stage_no, len(rows), podium)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
