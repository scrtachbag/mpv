"""Notifications push (Web Push / VAPID) selon l'événement du jour.

    python notify.py --event open       # nouvelle étape : paris ouverts
    python notify.py --event reminder    # ~30 min avant la clôture (non-parieurs)
    python notify.py --event close       # paris fermés
    python notify.py --event results     # classement de l'étape publié

Anti-spam : chaque étape porte des drapeaux notified_open / notified_close /
notified_results (cf. migration 0011). Une transition n'est notifiée qu'une
fois — indispensable car le job « résultats » tourne en boucle (poll).

Ce job n'envoie que des notifications ; il ne touche ni au scoring ni aux côtes.
"""
import argparse
import json
import logging
from datetime import datetime

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


def notify_event(event: str) -> int:
    config.require_supabase()
    if not (config.VAPID_PRIVATE_KEY and config.VAPID_PUBLIC_KEY):
        log.warning("Clés VAPID absentes : notifications désactivées.")
        return 0
    now = datetime.now(config.TZ)
    today = now.date().isoformat()
    subs = _targets_for(event, _subs())  # respecte les préférences de chacun

    if event == "reminder":
        stages = db.select("stages", {"date": f"eq.{today}", "odds_status": "eq.published",
                                       "select": "id,label,bet_deadline"})
        stage = next((s for s in stages if datetime.fromisoformat(s["bet_deadline"]) > now), None)
        if not stage:
            log.info("Aucune étape ouverte : rien à rappeler.")
            return 0
        bets = db.select("bets", {"stage_id": f"eq.{stage['id']}", "select": "user_id"})
        betters = {b["user_id"] for b in bets}
        targets = [s for s in subs if s["user_id"] not in betters]
        _send(targets, "🚴 Mon Petit Vélo",
              f"Plus que ~30 min pour parier sur {stage['label']} ! 🚲", "mpv-reminder", ttl=900)
        return 0

    if event == "open":
        stages = db.select("stages", {"odds_status": "eq.published", "notified_open": "is.false",
                                       "select": "id,label,bet_deadline"})
        stages = [s for s in stages if datetime.fromisoformat(s["bet_deadline"]) > now]
        for s in stages:
            _send(subs, "🚴 Nouvelle étape !",
                  f"Les paris sont ouverts pour {s['label']} — choisis ton coureur avant midi ! 🚲",
                  "mpv-open", ttl=57600)
            db.update("stages", {"id": s["id"]}, {"notified_open": True})
        if not stages:
            log.info("Aucune nouvelle étape à annoncer.")
        return 0

    if event == "close":
        stages = db.select("stages", {"date": f"eq.{today}", "notified_close": "is.false",
                                       "select": "id,label,bet_deadline"})
        stages = [s for s in stages if datetime.fromisoformat(s["bet_deadline"]) <= now]
        for s in stages:
            _send(subs, "🏁 Paris fermés",
                  f"Les paris sont clos pour {s['label']}. Que la course commence !", "mpv-close", ttl=3600)
            db.update("stages", {"id": s["id"]}, {"notified_close": True})
        if not stages:
            log.info("Aucune étape à clôturer.")
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
    ap.add_argument("--event", required=True, choices=["open", "reminder", "close", "results"])
    return notify_event(ap.parse_args().event)


if __name__ == "__main__":
    raise SystemExit(main())
