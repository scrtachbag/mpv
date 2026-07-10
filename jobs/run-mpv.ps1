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
#     .\run-mpv.ps1 odds    [args...]     # cote l'étape du JOUR par défaut
#     .\run-mpv.ps1 soir    [n°étape]     # résultats du jour PUIS cotes de DEMAIN
# Exemples :
#     .\run-mpv.ps1 results 4             # classement de l'étape 4
#     .\run-mpv.ps1 odds --stage 6        # cotes forcées sur l'étape 6
#     .\run-mpv.ps1 odds --offset-days 1  # cotes de DEMAIN (ce que fait la tâche du soir)
# Si l'exécution est bloquée par la stratégie PowerShell :
#     powershell -ExecutionPolicy Bypass -File .\run-mpv.ps1 results 4
# --------------------------------------------------------------------------
param(
  [Parameter(Mandatory = $true)][ValidateSet('results', 'odds', 'soir', 'precreate')][string]$Cmd,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Journalise chaque exécution (diagnostic des tâches planifiées). Fichier *.log ignoré par git.
$log = Join-Path $PSScriptRoot ('mpv-run-' + (Get-Date -Format 'yyyy-MM') + '.log')
try { Start-Transcript -Path $log -Append -ErrorAction SilentlyContinue | Out-Null } catch {}

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

# Notifs : l'ENVOI se fait sur GitHub (notify.yml a les clés VAPID). Pour être
# RÉACTIF, on déclenche le workflow tout de suite (workflow_dispatch) au lieu
# d'attendre le prochain tick du cron (~20 min + retard GitHub). Nécessite un PAT
# fine-grained (permission "Actions: write" sur le dépôt) dans .mpv-secrets.ps1 :
#     $env:MPV_GH_TOKEN = "github_pat_..."
# Sans token : ignoré (le cron enverra la notif au tick suivant, juste moins vite).
function Dispatch-Notif([string]$ev) {
  if (-not $env:MPV_GH_TOKEN) { Write-Host "notif '$ev' : pas de MPV_GH_TOKEN -> le cron s'en chargera"; return }
  $body = @{ ref = 'master'; inputs = @{ event = $ev } } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Method Post -TimeoutSec 20 `
      -Uri 'https://api.github.com/repos/scrtachbag/mpv/actions/workflows/notify.yml/dispatches' `
      -Headers @{ Authorization = "Bearer $env:MPV_GH_TOKEN"; Accept = 'application/vnd.github+json';
                  'User-Agent' = 'mpv-local'; 'X-GitHub-Api-Version' = '2022-11-28' } `
      -Body $body -ContentType 'application/json' | Out-Null
    Write-Host "notif '$ev' declenchee sur GitHub (envoi imminent)"
  } catch { Write-Warning "dispatch notif '$ev' : $_" }
}

# Publie les résultats et, SEULEMENT si un classement est réellement tombé
# (log 'enregistrée'), déclenche la notif -> pas de run inutile aux polls à vide.
function Invoke-Results([string[]]$extra) {
  # Les logs INFO de Python arrivent sur stderr. Si PowerShell fait le 2>&1, il
  # crée des ErrorRecord (NativeCommandError) -> tâche en échec / journal pollué.
  # On laisse cmd /c fusionner stderr+stdout AVANT : PowerShell ne voit que du
  # texte. On détecte la publication au mot 'enregistr'.
  $out = (& cmd /c "python fetch_results.py $($extra -join ' ') 2>&1" | Out-String)
  Write-Host $out
  if ($out -match 'enregistr') { Dispatch-Notif 'results' }
}

switch ($Cmd) {
  'results' {
    if ($Rest) { Invoke-Results @('--stage', $Rest[0]) } else { Invoke-Results @() }
  }
  'odds' {
    python fetch_odds.py @Rest
    Dispatch-Notif 'open'   # 1×/jour à 20h : ouverture des paris du lendemain
  }
  'soir' {
    if ($Rest) { Invoke-Results @('--stage', $Rest[0]) } else { Invoke-Results @() }
    python fetch_odds.py --offset-days 1   # cote l'étape de DEMAIN (veille au soir)
    Dispatch-Notif 'open'
  }
  'precreate' {
    python precreate_stages.py @Rest       # crée les étapes à venir (pré-choix sans cotes)
  }
}

try { Stop-Transcript -ErrorAction SilentlyContinue | Out-Null } catch {}
