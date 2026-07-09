# --------------------------------------------------------------------------
# Enregistre les tâches planifiées Windows de Mon Petit Vélo, qui rejouent
# run-mpv.ps1 automatiquement jusqu'à la fin du Tour (dernière étape 2026-07-26).
# Le SITE reste sur GitHub/Supabase ; ces tâches ne font QU'écrire les données
# depuis ta machine (IP résidentielle -> pas de blocage Cloudflare).
#
# À lancer UNE fois dans PowerShell (réexécutable : recrée les tâches) :
#     powershell -ExecutionPolicy Bypass -File .\setup-tasks.ps1
# Si "accès refusé" : relance dans un PowerShell "Exécuter en administrateur".
#
# Prérequis : jobs\.mpv-secrets.ps1 doit exister (clé service_role).
# Supprimer les tâches plus tard :
#     Unregister-ScheduledTask -TaskName 'MPV - Cotes du soir','MPV - Resultats du soir' -Confirm:$false
# --------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'
$here   = $PSScriptRoot
$script = Join-Path $here 'run-mpv.ps1'
$end    = '2026-07-26T23:59:59'   # dernière étape du Tour 2026 (étape 21)

if (-not (Test-Path (Join-Path $here '.mpv-secrets.ps1'))) {
  throw "jobs\.mpv-secrets.ps1 manquant : crée-le d'abord (clé service_role)."
}

# Réglages communs : tourne sur batterie et rattrape si l'heure est passée
# (PC éteint au moment prévu -> exécution au prochain démarrage).
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

function New-MpvAction([string]$mpvArgs) {
  New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" $mpvArgs" `
    -WorkingDirectory $here
}

# --- Cotes : chaque soir à 20:00, cote l'étape du lendemain (ouvre les paris) ---
$tOdds = New-ScheduledTaskTrigger -Daily -At '20:00'
$tOdds.EndBoundary = $end
Register-ScheduledTask -TaskName 'MPV - Cotes du soir' -Force -Settings $settings `
  -Action (New-MpvAction 'odds --offset-days 1') -Trigger $tOdds `
  -Description 'Mon Petit Velo : calcule les cotes de l etape du LENDEMAIN (ouvre les paris la veille au soir).'

# --- Résultats : chaque soir de 17:00 à 22:00, toutes les 20 min ---
$tRes = New-ScheduledTaskTrigger -Daily -At '17:00'
$tRes.Repetition = (New-ScheduledTaskTrigger -Once -At '17:00' `
    -RepetitionInterval (New-TimeSpan -Minutes 20) `
    -RepetitionDuration (New-TimeSpan -Hours 5)).Repetition
$tRes.EndBoundary = $end
Register-ScheduledTask -TaskName 'MPV - Resultats du soir' -Force -Settings $settings `
  -Action (New-MpvAction 'results') -Trigger $tRes `
  -Description 'Mon Petit Velo : publie le classement de l etape du jour des qu il est officiel.'

Write-Host ''
Write-Host 'Taches creees jusqu au 2026-07-26 :' -ForegroundColor Green
Get-ScheduledTask -TaskName 'MPV *' | Format-Table TaskName, State
