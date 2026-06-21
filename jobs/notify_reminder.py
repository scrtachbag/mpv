"""Job de rappel : pousse une notification aux joueurs abonnés qui n'ont PAS
encore parié sur l'étape du jour (à lancer ~15 min avant la clôture).

Le classement/scoring n'est pas concerné ; ce job ne fait qu'envoyer des
notifications push (Web Push / VAPID).

Usage :
    python notify_reminder.py
"""
import json
import logging
from datetime import datetime

import config
import supabase_client as db

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mpv.reminder")


def main() -> int:
    config.require_supabase()
    if not (config.VAPID_PRIVATE_KEY and config.VAPID_PUBLIC_KEY):
        log.error("Clés VAPID absentes (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).")
        return 1

    now = datetime.now(config.TZ)
    today = now.date().isoformat()

    # Étape du jour, cotes publiées, pas encore clôturée.
    stages = db.select("stages", {
        "date": f"eq.{today}",
        "odds_status": "eq.published",
        "select": "id,label,bet_deadline",
    })
    stage = next((s for s in stages
                  if datetime.fromisoformat(s["bet_deadline"]) > now), None)
    if not stage:
        log.info("Aucune étape ouverte aujourd'hui. Rien à notifier.")
        return 0

    # Joueurs ayant déjà parié sur cette étape.
    bets = db.select("bets", {"stage_id": f"eq.{stage['id']}", "select": "user_id"})
    betters = {b["user_id"] for b in bets}

    subs = db.select("push_subscriptions", {"select": "endpoint,p256dh,auth,user_id"})
    targets = [s for s in subs if s["user_id"] not in betters]
    if not targets:
        log.info("Tous les abonnés ont déjà parié (ou aucun abonné).")
        return 0

    from pywebpush import webpush, WebPushException  # import tardif (uniquement si envoi)

    payload = json.dumps({
        "title": "🚴 Mon Petit Vélo",
        "body": f"Plus que ~30 min pour parier sur {stage['label']} ! 🚲",
        "url": config.SITE_URL,
        "tag": "mpv-reminder",
    })

    sent, removed = 0, 0
    for s in targets:
        try:
            webpush(
                subscription_info={
                    "endpoint": s["endpoint"],
                    "keys": {"p256dh": s["p256dh"], "auth": s["auth"]},
                },
                data=payload,
                vapid_private_key=config.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": config.VAPID_SUBJECT},
                ttl=900,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                # Abonnement expiré : on le supprime.
                db.delete("push_subscriptions", {"endpoint": s["endpoint"]})
                removed += 1
            else:
                log.warning("Échec push (%s) : %s", status, exc)
        except Exception as exc:  # noqa: BLE001 — un abonnement KO ne doit pas tout stopper
            log.warning("Abonnement ignoré (erreur : %s)", exc)

    log.info("Rappels envoyés : %d ; abonnements expirés supprimés : %d", sent, removed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
