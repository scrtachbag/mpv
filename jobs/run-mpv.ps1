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
# Requête DIRECTE : pas de scraper ni FlareSolverr (inutiles depuis chez toi).
Remove-Item Env:MPV_SCRAPER_API_URL  -ErrorAction SilentlyContinue
Remove-Item Env:MPV_FLARESOLVERR_URL -ErrorAction SilentlyContinue

# NB : les notifications push (étape ouverte / résultats) sont envoyées par le
# cron GitHub notify.yml (qui a les clés VAPID et ne lit que Supabase) dès que
# ce script a écrit les données. Rien à faire ici.

switch ($Cmd) {
  'results' {
    if ($Rest) { python fetch_results.py --stage $Rest[0] } else { python fetch_results.py }
  }
  'odds' { python fetch_odds.py @Rest }
  'soir' {
    if ($Rest) { python fetch_results.py --stage $Rest[0] } else { python fetch_results.py }
    python fetch_odds.py
  }
}
