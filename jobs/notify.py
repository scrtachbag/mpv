"""Notifications push (Web Push / VAPID) selon l'événement du jour.

    python notify.py --event open       # nouvelle étape : paris ouverts
    python notify.py --event reminder    # peu avant la clôture (non-parieurs)
    python notify.py --event close       # paris fermés
    python notify.py --event results     # classement de l'étape publié
    python notify.py --event tick        # rappel + clôture (exécuté régulièrement)

Rappel et clôture suivent la VRAIE deadline (= heure de départ de l'étape) :
le "tick" tourne toutes les ~20 min l'après-midi et déclenche le rappel dans une
fenêtre avant la deadline, puis la clôture une fois la deadline passée.

Anti-spam : chaque étape porte des drapeaux notified_open / notified_reminder /
notified_close / notified_results. Une transition n'est notifiée qu'une fois.

Ce job n'envoie que des notifications ; il ne touche ni au scoring ni aux côtes.
"""
import argparse
import json
import logging
from datetime import datetime, timedelta

import config
import supabase_client as db

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mpv.notify")


def _subs() -> list[dict]:
    return db.select("push_subscriptions", {"select": "endpoint,p256dh,auth,user_id"})


def _targets_for(event: str, subs: list[dict]) -> list[dict]:
    """Garde les abonnements des utilisateurs qui VEULENT ce type de notif
    (notify_enabled ET notify_<event>). Par défaut tout est activé."""
    prefs = {p["id"]: p for p in db.select("profiles", {
        "select": "id,notify_enabled,notify_open,notify_reminder,notify_close,notify_results"})}

    def wants(uid: str) -> bool:
        p = prefs.get(uid, {})
        return p.get("notify_enabled", True) and p.get(f"notify_{event}", True)

    return [s for s in subs if wants(s["user_id"])]


def _send(targets: list[dict], title: str, body: str, tag: str, ttl: int = 86400) -> int:
    if not targets:
        log.info("Aucun destinataire pour « %s ».", tag)
        return 0
    from pywebpush import webpush, WebPushException  # import tardif (uniquement si envoi)
    payload = json.dumps({"title": title, "body": body, "url": config.SITE_URL, "tag": tag})
    sent = removed = 0
    for s in targets:
        try:
            webpush(
                subscription_info={"endpoint": s["endpoint"],
                                   "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}},
                data=payload,
                vapid_private_key=config.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": config.VAPID_SUBJECT},
                ttl=ttl,
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):  # abonnement expiré
                db.delete("push_subscriptions", {"endpoint": s["endpoint"]})
                removed += 1
            else:
                log.warning("Échec push (%s) : %s", status, exc)
        except Exception as exc:  # noqa: BLE001 — un abonnement KO ne stoppe pas les autres
            log.warning("Abonnement ignoré (%s)", exc)
    log.info("« %s » : %d envoyée(s), %d abonnement(s) expiré(s) supprimé(s).", tag, sent, removed)
    return sent


def _reminder(now: datetime, today: str) -> None:
    """Rappel aux non-parieurs, ~REMINDER_WINDOW_MIN avant la VRAIE deadline
    (heure de départ de l'étape). Envoyé une seule fois (notified_reminder)."""
    subs = _targets_for("reminder", _subs())
    rows = db.select("stages", {"date": f"eq.{today}", "odds_status": "eq.published",
                                "notified_reminder": "is.false",
                                "select": "id,label,bet_deadline"})
    win = timedelta(minutes=config.REMINDER_WINDOW_MIN)
    stage = next((s for s in rows
                  if now < datetime.fromisoformat(s["bet_deadline"]) <= now + win), None)
    if not stage:
        log.info("Aucun rappel à envoyer (hors fenêtre avant la clôture).")
        return
    bets = db.select("bets", {"stage_id": f"eq.{stage['id']}", "select": "user_id"})
    betters = {b["user_id"] for b in bets}
    targets = [s for s in subs if s["user_id"] not in betters]
    dl = datetime.fromisoformat(stage["bet_deadline"]).astimezone(config.TZ).strftime("%Hh%M")
    _send(targets, "🚴 Mon Petit Vélo",
          f"Dernière ligne droite pour parier sur {stage['label']} — clôture à {dl} ! 🚲",
          "mpv-reminder", ttl=1800)
    db.update("stages", {"id": stage["id"]}, {"notified_reminder": True})


def _close(now: datetime, today: str) -> None:
    """Notifie « paris fermés » dès que la deadline est passée (une seule fois)."""
    subs = _targets_for("close", _subs())
    rows = db.select("stages", {"date": f"eq.{today}", "notified_close": "is.false",
                                "select": "id,label,bet_deadline"})
    done = False
    for s in rows:
        if datetime.fromisoformat(s["bet_deadline"]) <= now:
            _send(subs, "🏁 Paris fermés",
                  f"Les paris sont clos pour {s['label']}. Que la course commence !",
                  "mpv-close", ttl=3600)
            db.update("stages", {"id": s["id"]}, {"notified_close": True})
            done = True
    if not done:
        log.info("Aucune étape à clôturer (deadline pas encore atteinte).")


def notify_event(event: str) -> int:
    config.require_supabase()
    if not (config.VAPID_PRIVATE_KEY and config.VAPID_PUBLIC_KEY):
        log.warning("Clés VAPID absentes : notifications désactivées.")
        return 0
    now = datetime.now(config.TZ)
    today = now.date().isoformat()

    if event == "tick":         # exécuté régulièrement l'après-midi
        _reminder(now, today)
        _close(now, today)
        return 0
    if event == "reminder":
        _reminder(now, today)
        return 0
    if event == "close":
        _close(now, today)
        return 0

    subs = _targets_for(event, _subs())  # respecte les préférences de chacun

    if event == "open":
        stages = db.select("stages", {"odds_status": "eq.published", "notified_open": "is.false",
                                       "select": "id,label,bet_deadline"})
        stages = [s for s in stages if datetime.fromisoformat(s["bet_deadline"]) > now]
        for s in stages:
            _send(subs, "🚴 Nouvelle étape !",
                  f"Les paris sont ouverts pour {s['label']} — fais ton prono avant le départ ! 🚲",
                  "mpv-open", ttl=57600)
            db.update("stages", {"id": s["id"]}, {"notified_open": True})
        if not stages:
            log.info("Aucune nouvelle étape à annoncer.")
        return 0

    if event == "results":
        stages = db.select("stages", {"results_status": "eq.official", "notified_results": "is.false",
                                       "select": "id,label"})
        for s in stages:
            _send(subs, "🏆 Résultats !",
                  f"Le classement de {s['label']} est tombé — va voir où tu te places !", "mpv-results")
            db.update("stages", {"id": s["id"]}, {"notified_results": True})
        if not stages:
            log.info("Aucun résultat à annoncer.")
        return 0

    log.error("Événement inconnu : %s", event)
    return 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--event", required=True,
                    choices=["open", "reminder", "close", "results", "tick"])
    return notify_event(ap.parse_args().event)


if __name__ == "__main__":
    raise SystemExit(main())
