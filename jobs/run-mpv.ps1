# --------------------------------------------------------------------------
# Récupération MPV en LOCAL, depuis TA machine (IP résidentielle -> PCS répond
# normalement, aucun blocage Cloudflare). Le SITE ne bouge pas : il reste sur
# GitHub Pages + Supabase. Ce script ne fait qu'écrire les données dans Supabase.
#
# Prérequis (UNE seule fois) : créer le fichier  jobs\.mpv-secrets.ps1  contenant :
#     $env:SUPABASE_SERVICE_KEY = "eyJ..."   # clé service_role :
#         Supabase -> Project Settings -> API -> service_role (Reveal/Copy)
# Ce fichier est ignoré par git (voir .gitignore) : ne jamais le committer.
#
# Usage (PowerShell, depuis le dossier jobs) :
#     .\run-mpv.ps1 results [n°étape]     # publie le classement (défaut: étape du jour)
#     .\run-mpv.ps1 odds    [args...]     # calcule les cotes (défaut: étape de demain)
#     .\run-mpv.ps1 soir    [n°étape]     # résultats du jour PUIS cotes de demain
# Exemples :
#     .\run-mpv.ps1 results 4             # classement de l'étape 4
#     .\run-mpv.ps1 odds                  # cotes de l'étape de demain
#     .\run-mpv.ps1 odds --stage 5        # cotes forcées sur l'étape 5
# Si l'exécution est bloquée par la stratégie PowerShell :
#     powershell -ExecutionPolicy Bypass -File .\run-mpv.ps1 results 4
# --------------------------------------------------------------------------
param(
  [Parameter(Mandatory = $true)][ValidateSet('results', 'odds', 'soir')][string]$Cmd,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Secret : chargé depuis .mpv-secrets.ps1, ou déjà présent dans l'environnement.
if (Test-Path '.mpv-secrets.ps1') { . .\.mpv-secrets.ps1 }
if (-not $env:SUPABASE_SERVICE_KEY) {
  throw "Manque SUPABASE_SERVICE_KEY -> crée jobs\.mpv-secrets.ps1 (voir en-tête du script)"
}

$env:SUPABASE_URL = 'https://lprhfzmligohzucyurjm.supabase.co'
if (-not $env:MPV_SEASON)    { $env:MPV_SEASON = '2026' }
if (-not $env:MPV_RACE_SLUG) { $env:MPV_RACE_SLUG = 'tour-de-france' }
# Notifications push (facultatif) : cible ouverte au clic + expéditeur VAPID.
# Les clés VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY vont dans .mpv-secrets.ps1.
if (-not $env:MPV_SITE_URL)  { $env:MPV_SITE_URL  = 'https://www.mon-petit-velo.fr' }
if (-not $env:VAPID_SUBJECT) { $env:VAPID_SUBJECT = 'mailto:contact@mon-petit-velo.fr' }
# Requête DIRECTE : pas de scraper ni FlareSolverr (inutiles depuis chez toi).
Remove-Item Env:MPV_SCRAPER_API_URL  -ErrorAction SilentlyContinue
Remove-Item Env:MPV_FLARESOLVERR_URL -ErrorAction SilentlyContinue

# Envoi d'une notif push. Ignoré si pas de clé VAPID ; ne fait jamais échouer le
# run (l'écriture des données reste prioritaire). notify.py est idempotent
# (drapeaux notified_* -> une transition n'est notifiée qu'une fois).
function Send-Notif([string]$ev) {
  if (-not $env:VAPID_PRIVATE_KEY) {
    Write-Host "notif '$ev' ignoree (ajoute VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY dans .mpv-secrets.ps1)"
    return
  }
  try { python notify.py --event $ev } catch { Write-Warning "notif '$ev' : $_" }
}

switch ($Cmd) {
  'results' {
    if ($Rest) { python fetch_results.py --stage $Rest[0] } else { python fetch_results.py }
    Send-Notif 'results'
  }
  'odds' {
    python fetch_odds.py @Rest
    Send-Notif 'open'
  }
  'soir' {
    if ($Rest) { python fetch_results.py --stage $Rest[0] } else { python fetch_results.py }
    Send-Notif 'results'
    python fetch_odds.py
    Send-Notif 'open'
  }
}
