"""Configuration des jobs MPV, lue depuis les variables d'environnement.

En CI GitLab, ces variables sont définies dans :
    Settings > CI/CD > Variables
Au minimum : SUPABASE_URL et SUPABASE_SERVICE_KEY (clé service_role, *secrète*).
"""
import os
from datetime import datetime
from zoneinfo import ZoneInfo


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


# --- Supabase ---------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# --- Course -----------------------------------------------------------------
TZ = ZoneInfo(os.environ.get("MPV_TZ", "Europe/Paris"))
RACE_SLUG = os.environ.get("MPV_RACE_SLUG", "tour-de-france")
SEASON = _int("MPV_SEASON", datetime.now(TZ).year)

# Heure limite des paris (12h00 par défaut, heure locale TZ).
BET_HOUR = _int("MPV_BET_HOUR", 12)

# --- Paramètres de calcul des côtes "maison" -------------------------------
# Probabilité d'un coureur ∝ (points PCS) ** ALPHA, puis côte = MARGIN / p,
# bornée entre ODDS_MIN et ODDS_MAX. ALPHA pilote l'écart favoris/outsiders.
ODDS_ALPHA = _float("MPV_ODDS_ALPHA", 1.8)
ODDS_MARGIN = _float("MPV_ODDS_MARGIN", 1.15)
ODDS_MIN = _float("MPV_ODDS_MIN", 1.5)
ODDS_MAX = _float("MPV_ODDS_MAX", 500.0)
# Points plancher pour un coureur absent du classement PCS (évite côte = MAX).
ODDS_FLOOR_POINTS = _float("MPV_ODDS_FLOOR_POINTS", 5.0)
# Pondération : forme récente vs points dans la spécialité de l'étape.
ODDS_FORM_WEIGHT = _float("MPV_ODDS_FORM_WEIGHT", 0.5)
ODDS_SPEC_WEIGHT = _float("MPV_ODDS_SPEC_WEIGHT", 1.0)

# Nombre de positions de résultat à enregistrer (le top 10 suffit au score).
RESULTS_TOP_N = _int("MPV_RESULTS_TOP_N", 30)

# --- Notifications push (Web Push / VAPID) ----------------------------------
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")
# URL ouverte au clic sur la notification (idéalement l'URL GitHub Pages).
SITE_URL = os.environ.get("MPV_SITE_URL", "/")


def require_supabase() -> None:
    missing = [n for n, v in (("SUPABASE_URL", SUPABASE_URL),
                              ("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY)) if not v]
    if missing:
        raise SystemExit("Variables manquantes : " + ", ".join(missing))
