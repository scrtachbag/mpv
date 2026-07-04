"""Job du matin : publie l'étape du jour + les côtes (dépendantes du profil
d'étape et de la forme des coureurs).

Usage :
    python fetch_odds.py                      # étape du jour -> écrit en base
    python fetch_odds.py --stage 5            # force l'étape 5
    python fetch_odds.py --dry-run --stage 5  # calcule et AFFICHE, sans écrire
    python fetch_odds.py --stage 5 --save-snapshot snap.json   # capture les données PCS
    python fetch_odds.py --from-snapshot snap.json             # rejoue hors-ligne (sans PCS)

Les deux derniers modes servent à tester le calcul sans dépendre de PCS :
capture une fois depuis une machine où PCS répond, puis rejoue partout.
"""
import argparse
import json
import logging
from datetime import datetime, time

import config
import odds
import supabase_client as db

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mpv.odds")


def _deadline_iso(date_str: str, start_time: str | None = None) -> str:
    """Deadline de pari = heure de DÉPART de l'étape (heure locale de course) si
    connue, sinon repli sur BET_HOUR (midi par défaut)."""
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    t = time(hour=config.BET_HOUR)
    if start_time:
        try:
            hh, mm = start_time.split(":")[:2]
            t = time(hour=int(hh), minute=int(mm))
        except (ValueError, IndexError):
            pass
    return datetime.combine(d, t, tzinfo=config.TZ).isoformat()


def _print_favorites(rows):
    fav = sorted(rows, key=lambda x: x["odds"])[:8]
    log.info("%d coureurs cotés. Favoris : %s", len(rows),
             ", ".join(f"{r['rider_name']} ({r['odds']})" for r in fav))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", type=int)
    ap.add_argument("--date")
    ap.add_argument("--season", type=int, help=f"saison (défaut: {config.SEASON})")
    ap.add_argument("--slug", help=f"course PCS (défaut: {config.RACE_SLUG})")
    ap.add_argument("--dry-run", action="store_true", help="calcule et affiche, sans écrire en base")
    ap.add_argument("--save-snapshot", metavar="PATH", help="dump des données PCS (forme/spécialités) en JSON")
    ap.add_argument("--from-snapshot", metavar="PATH", help="calcule à partir d'un JSON (sans PCS)")
    ap.add_argument("--sleep", type=float, default=0.0, help="pause entre requêtes PCS (politesse)")
    ap.add_argument("--limit", type=int, help="limiter le nombre de coureurs (debug)")
    ap.add_argument("--offset-days", type=int, default=0,
                    help="décalage de date (1 = étape de DEMAIN, pour un calcul la veille au soir)")
    ap.add_argument("--alpha", type=float, help="surcharge ALPHA (concentration des favoris)")
    ap.add_argument("--form-bonus", type=float, help="surcharge FORM_BONUS (poids de la forme)")
    args = ap.parse_args()
    from models import RiderForm  # local (pas de PCS)

    # --- Mode rejeu hors-ligne : aucune dépendance PCS ---
    if args.from_snapshot:
        with open(args.from_snapshot, encoding="utf-8") as f:
            snap = json.load(f)
        profile = snap.get("profile")
        forms = [RiderForm.from_json(d) for d in snap["riders"]]
        rows = odds.compute_odds(forms, profile, alpha=args.alpha, form_bonus=args.form_bonus)
        log.info("Profil '%s' (snapshot)", profile)
        _print_favorites(rows)
        return 0

    # --- Sinon : on interroge PCS ---
    import pcs  # import tardif (déclenche procyclingstats)
    season = args.season or config.SEASON
    slug = args.slug or config.RACE_SLUG
    from datetime import timedelta
    target = (datetime.now(config.TZ).date() + timedelta(days=args.offset_days)).isoformat()
    target = args.date or target
    info = pcs.find_stage(season, slug,
                          date=None if args.stage else target, number=args.stage)
    if info is None:
        if args.stage:
            log.warning("Étape %s introuvable pour %s %s (mauvaise saison, étape "
                        "pas encore en ligne, ou PCS injoignable ?).", args.stage, slug, season)
        else:
            log.info("Aucune étape datée du %s pour %s %s. Rien à faire.", target, slug, season)
        return 0
    log.info("Étape %s du %s : %s [profil: %s] — clôture des paris à %s",
             info.stage_no, info.date, info.name or "?", info.profile_type,
             info.start_time or f"{config.BET_HOUR}h (défaut)")

    # Récence mesurée par rapport à la date de l'étape (les résultats des étapes
    # déjà courues du Tour comptent fortement le soir de la veille).
    from datetime import date as _date
    try:
        ref_date = _date.fromisoformat(info.date)
    except (TypeError, ValueError):
        ref_date = None
    forms = pcs.get_rider_forms(season, slug, ref_date=ref_date, sleep=args.sleep, limit=args.limit)
    if not forms:
        log.error("Startlist vide : impossible de coter l'étape.")
        return 1

    if args.save_snapshot:
        with open(args.save_snapshot, "w", encoding="utf-8") as f:
            json.dump({"stage": {"stage_no": info.stage_no, "date": info.date,
                                 "name": info.name, "profile_type": info.profile_type},
                       "profile": info.profile_type,
                       "riders": [rf.to_json() for rf in forms]}, f, ensure_ascii=False, indent=2)
        log.info("Snapshot écrit : %s", args.save_snapshot)

    rows = odds.compute_odds(forms, info.profile_type, alpha=args.alpha, form_bonus=args.form_bonus)
    _print_favorites(rows)

    if args.dry_run:
        log.info("--dry-run : rien écrit en base.")
        return 0

    # --- Écriture en base ---
    config.require_supabase()
    stage_id = db.upsert_stage({
        "season": season, "stage_no": info.stage_no,
        "label": f"Étape {info.stage_no}", "name": info.name,
        "profile_type": info.profile_type, "date": info.date,
        "bet_deadline": _deadline_iso(info.date, info.start_time), "odds_status": "pending",
    })
    for r in rows:
        r["stage_id"] = stage_id
    db.delete("stage_riders", {"stage_id": stage_id})
    db.upsert("stage_riders", rows, on_conflict="stage_id,rider_name")
    db.update("stages", {"id": stage_id}, {"odds_status": "published"})
    log.info("Côtes publiées pour l'étape %s.", info.stage_no)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
