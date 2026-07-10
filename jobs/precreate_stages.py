"""Pré-création des étapes À VENIR (rangées 'pending', SANS cotes).

But : permettre le PRÉ-CHOIX d'un coureur pour une étape avant son ouverture
officielle. L'étape existe en base (date, profil, deadline) mais sans cotes ;
les joueurs peuvent déjà choisir un coureur. Les cotes (calibrées marché) sont
publiées plus tard par fetch_odds, la veille au soir — le pré-choix devient alors
un pari normal, ajustable jusqu'à la deadline.

On n'écrase JAMAIS une étape déjà en base (créée ou cotée) : on n'insère que les
étapes futures manquantes.

Usage :
    python precreate_stages.py                 # crée les étapes à venir
    python precreate_stages.py --season 2026 --max 21
"""
import argparse
import logging
from datetime import datetime

import config
import pcs
import supabase_client as db
from fetch_odds import _deadline_iso

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mpv.precreate")


def main() -> int:
    config.require_supabase()
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, help=f"saison (défaut: {config.SEASON})")
    ap.add_argument("--slug", help=f"course PCS (défaut: {config.RACE_SLUG})")
    ap.add_argument("--max", type=int, default=pcs.MAX_STAGES, help="n° d'étape max à scruter")
    args = ap.parse_args()
    season = args.season or config.SEASON
    slug = args.slug or config.RACE_SLUG
    today = datetime.now(config.TZ).date().isoformat()

    existing = {r["stage_no"] for r in
                db.select("stages", {"season": f"eq.{season}", "select": "stage_no"})}

    created = 0
    for n in range(1, args.max + 1):
        info = pcs.find_stage(season, slug, number=n)
        if info is None:
            break  # plus d'étape publiée sur PCS
        if info.date < today:
            continue  # étape passée
        if info.stage_no in existing:
            continue  # déjà en base (créée ou cotée) — on ne touche pas
        db.upsert_stage({
            "season": season, "stage_no": info.stage_no,
            "label": f"Étape {info.stage_no}", "name": info.name,
            "profile_type": info.profile_type, "date": info.date,
            "bet_deadline": _deadline_iso(info.date, info.start_time),
            # odds_status laissé au défaut 'pending' -> pré-choix sans cotes.
        })
        created += 1
        log.info("Étape %s pré-créée (%s, %s, deadline %s).",
                 info.stage_no, info.date, info.profile_type, info.start_time or "midi")

    log.info("%d étape(s) à venir pré-créée(s).", created)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
