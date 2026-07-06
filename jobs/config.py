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

# Heure limite des paris (repli si l'heure de départ PCS est inconnue).
BET_HOUR = _int("MPV_BET_HOUR", 12)
# Fenêtre (minutes avant la deadline) pendant laquelle le rappel est envoyé.
REMINDER_WINDOW_MIN = _int("MPV_REMINDER_WINDOW_MIN", 45)

# --- Paramètres de calcul des côtes "maison" -------------------------------
# poids = force ** ALPHA (force = spécialité × bonus de forme, cf. odds.py),
# proba = poids/Σ, côte = MARGIN/proba (bornée [ODDS_MIN, ODDS_MAX]).
# ALPHA pilote la concentration : ~3 => favori ~2-3 sur un sommet ; plus haut
# = favoris très écrasants, plus bas = côtes plus resserrées.
ODDS_ALPHA = _float("MPV_ODDS_ALPHA", 2.0)
ODDS_MARGIN = _float("MPV_ODDS_MARGIN", 1.15)
ODDS_MIN = _float("MPV_ODDS_MIN", 1.5)
# Plafond DUR des côtes : on coupe simplement à ODDS_MAX, sans recalculer les
# côtes inférieures. 100 = un coup gagnant rapporte au plus ~100 (×2 si 1er, ×10).
ODDS_MAX = _float("MPV_ODDS_MAX", 100.0)
# Points plancher pour un coureur absent du classement PCS (évite côte = MAX).
ODDS_FLOOR_POINTS = _float("MPV_ODDS_FLOOR_POINTS", 5.0)
# Modèle : force = points_spécialité_du_profil × (1 + FORM_BONUS × forme_normalisée).
# La spécialité (discipline) prime ; la forme récente (points PCS de la saison
# en cours) module : un coureur en forme remonte au-dessus des vétérans moins
# actifs. FORM_BONUS = bonus max (2.0 => +200% pour le coureur le plus en forme).
ODDS_FORM_BONUS = _float("MPV_ODDS_FORM_BONUS", 2.0)
# Forme = Σ pcs_points × exp(-jours_écoulés / TAU). 75 j => une course d'il y a
# ~2,5 mois pèse ~37 %, les classiques de printemps comptent encore un peu, et
# un résultat récent (Dauphiné/Tour de Suisse) pèse fortement.
ODDS_FORM_TAU_DAYS = _float("MPV_ODDS_FORM_TAU_DAYS", 75.0)
# Poids des résultats sans date (classements généraux/annexes PCS).
ODDS_FORM_UNDATED_WEIGHT = _float("MPV_ODDS_FORM_UNDATED_WEIGHT", 0.5)
# Sur une étape "hilly" (arrivée en bosse), on ajoute une part des points de
# grimpeur à la force one_day : certaines bosses (ex. Mûr-de-Bretagne) se jouent
# entre grimpeurs, pas seulement entre puncheurs/classicmen. 0 = désactivé.
ODDS_HILLY_CLIMBER = _float("MPV_ODDS_HILLY_CLIMBER", 0.5)

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
