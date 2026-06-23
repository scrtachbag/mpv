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
# poids = force ** ALPHA (force = spécialité × bonus de forme, cf. odds.py),
# proba = poids/Σ, côte = MARGIN/proba (bornée [ODDS_MIN, ODDS_MAX]).
# ALPHA pilote la concentration : ~3 => favori ~2-3 sur un sommet ; plus haut
# = favoris très écrasants, plus bas = côtes plus resserrées.
ODDS_ALPHA = _float("MPV_ODDS_ALPHA", 3.0)
ODDS_MARGIN = _float("MPV_ODDS_MARGIN", 1.15)
ODDS_MIN = _float("MPV_ODDS_MIN", 1.5)
ODDS_MAX = _float("MPV_ODDS_MAX", 500.0)
# Points plancher pour un coureur absent du classement PCS (évite côte = MAX).
ODDS_FLOOR_POINTS = _float("MPV_ODDS_FLOOR_POINTS", 5.0)
# Modèle : force = points_spécialité_du_profil × (1 + FORM_BONUS × forme_normalisée).
# La spécialité (discipline) prime ; la forme récente (points PCS de la saison
# en cours) module : un coureur en forme remonte au-dessus des vétérans moins
# actifs. FORM_BONUS = bonus max (1.0 => +100% pour le coureur le plus en forme).
ODDS_FORM_BONUS = _float("MPV_ODDS_FORM_BONUS", 1.0)
# Forme = Σ pcs_points × exp(-jours_écoulés / TAU). Plus TAU est petit, plus
# seules les courses TRÈS récentes comptent. 30 j => une course d'il y a 1
# mois pèse ~37 %, le Tour de Suisse (~3 sem. avant le Tour) ~50 %, et un
# résultat d'étape de la veille ~97 %.
ODDS_FORM_TAU_DAYS = _float("MPV_ODDS_FORM_TAU_DAYS", 30.0)
# Poids des résultats sans date (classements généraux/annexes PCS).
ODDS_FORM_UNDATED_WEIGHT = _float("MPV_ODDS_FORM_UNDATED_WEIGHT", 0.5)

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
