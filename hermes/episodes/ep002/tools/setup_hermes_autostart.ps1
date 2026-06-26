<#
  Make Hermes come back after EVERY reboot, with NO admin rights.

  A Windows restart shuts down WSL and kills Hermes; nothing restarts it.
  This installs a hidden launcher in your per-user Startup folder that, at
  every logon, boots WSL and runs hermes_autostart.sh (which starts the
  bridge and keeps WSL warm). No Administrator, no Scheduled Task service.

  Run (from WSL via interop, or a normal PowerShell):
    powershell -ExecutionPolicy Bypass -File .\setup_hermes_autostart.ps1
  Optional: -Distro Ubuntu  -WslUser smrai

  Pure ASCII on purpose, so it parses under any \\wsl decoding.
#>
param(
  [string]$Distro = "",
  [string]$WslUser = ""
)
$ErrorActionPreference = 'Stop'
function Info($m){ Write-Host "[autostart] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[warn] $m" -ForegroundColor Yellow }

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "wsl.exe not found. Install WSL first (admin PowerShell: wsl --install), reboot, then re-run."
}

# wsl -l -q emits UTF-16 with NUL bytes; strip them before parsing.
if (-not $Distro) {
  $raw = (& wsl.exe -l -q) 2>$null
  $Distro = ( ($raw -replace "`0","") -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -First 1 )
}
if (-not $Distro) { $Distro = "Ubuntu" }

if (-not $WslUser) {
  $WslUser = ( (& wsl.exe -d $Distro -- whoami) -replace "`0","" ).Trim()
}
if (-not $WslUser -or $WslUser -match 'no distribution|Error code|WSL_E_') {
  throw "Could not resolve the WSL user for distro '$Distro'. Re-run with explicit values, e.g.:  -Distro Ubuntu -WslUser smrai"
}
Info "distro=$Distro  user=$WslUser"

# Absolute path (no `$HOME` so nothing has to expand it on the Windows side).
$shScript = "/home/$WslUser/cognitia.cloud/hermes/episodes/ep002/tools/hermes_autostart.sh"
$wslCmd   = 'wsl.exe -d ' + $Distro + ' -u ' + $WslUser + ' bash -lc "bash ' + $shScript + '"'

# No-admin autostart: hidden .vbs launcher in the user's Startup folder.
$startup = [Environment]::GetFolderPath('Startup')
$vbsPath = Join-Path $startup 'HermesAutostart.vbs'
$vbs = 'Set s = CreateObject("WScript.Shell")' + "`r`n" + 's.Run "' + ($wslCmd -replace '"','""') + '", 0, False'
Set-Content -LiteralPath $vbsPath -Value $vbs -Encoding ASCII
Info "installed startup launcher: $vbsPath"

# Start it now so you do not have to reboot to test.
Info "starting Hermes now..."
try {
  & wsl.exe -d $Distro -u $WslUser bash -lc "bash $shScript"
  Start-Sleep -Seconds 2
  # curl-free health check via the script's 'status' mode (uses Python stdlib).
  $health = (& wsl.exe -d $Distro -u $WslUser bash -lc "bash $shScript status") -join ""
  if ($health -match '"ok"\s*:\s*true') { Info "Hermes is UP: $health" }
  else { Warn "health not confirmed yet: $health  (check: wsl bash -lc 'cat ~/.hermes_autostart.log')" }
} catch { Warn "could not start now: $_" }

Write-Host ""
Info "DONE. Hermes will auto-start at every logon/reboot (no admin needed)."
Write-Host "  verify after reboot: wsl bash -lc 'curl -s http://127.0.0.1:8765/health'"
Write-Host "  remove autostart:    del `"$vbsPath`""
