' Lance run-mpv.ps1 SANS aucune fenetre (window style 0), pour les taches
' planifiees MPV. wscript.exe est lui-meme sans fenetre, et il demarre PowerShell
' en mode masque -> plus de terminal qui apparait pendant que tu travailles.
' Usage : wscript.exe run-hidden.vbs <arguments pour run-mpv.ps1>
Option Explicit
Dim sh, fso, scriptDir, args, a, cmd
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
args = ""
For Each a In WScript.Arguments
  args = args & " " & a
Next
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptDir & "\run-mpv.ps1""" & args
' 0 = fenetre masquee ; True = on attend la fin pour propager le code de sortie.
WScript.Quit sh.Run(cmd, 0, True)
