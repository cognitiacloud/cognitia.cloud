<#
  Register a Windows logon task that brings Hermes back after EVERY reboot.

  Problem it solves: restarting Windows shuts down WSL and kills Hermes; nothing
  restarts it, so it "never comes back." This registers a per-user Scheduled
  Task (no admin needed) that, at every logon, boots WSL and runs
  hermes_autostart.sh — which starts the bridge and keeps WSL warm.

  Run once, in Windows PowerShell (from anywhere):
    powershell -ExecutionPolicy Bypass -File .\setup_hermes_autostart.ps1

  Optional overrides:
    -Distro Ubuntu      WSL distro name (default: your default distro)
    -WslUser smrai      WSL username   (default: auto-detected)
#>
param(
  [string]$Distro = "",
  [string]$WslUser = ""
)
$ErrorActionPreference = 'Stop'
function Info($m){ Write-Host "[autostart] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[warn] $m" -ForegroundColor Yellow }

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "wsl.exe not found — install WSL first (PowerShell admin: wsl --install), reboot, then re-run."
}

# Resolve default distro + user if not supplied.
if (-not $Distro) {
  $Distro = (& wsl.exe -l -q | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1)
  if ($Distro) { $Distro = $Distro.Trim() }
}
if (-not $Distro) { throw "No WSL distro found. Run 'wsl --list' and pass -Distro <name>." }
if (-not $WslUser) { $WslUser = (& wsl.exe -d $Distro -- whoami).Trim() }
Info "distro=$Distro  user=$WslUser"

$script = "`$HOME/cognitia.cloud/hermes/episodes/ep002/tools/hermes_autostart.sh"
# Non-interactive login shell so PATH/conda are available; banner output is
# harmless here (this is NOT the MCP stdio channel).
$bash = "bash -lc `"bash $script`""
$argLine = "-d $Distro -u $WslUser $bash"

Info "registering scheduled task 'HermesAutostart' (at logon)…"
$action   = New-ScheduledTaskAction -Execute "wsl.exe" -Argument $argLine
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "HermesAutostart" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Info "task registered."

Info "starting Hermes now (so you don't have to reboot to test)…"
try {
  & wsl.exe -d $Distro -u $WslUser bash -lc "bash $script"
  Start-Sleep -Seconds 2
  $health = (& wsl.exe -d $Distro -u $WslUser bash -lc "curl -s http://127.0.0.1:8765/health || true")
  if ($health -match '"ok"\s*:\s*true') { Info "Hermes is UP: $health" }
  else { Warn "health check didn't confirm yet: $health  (check ~/.hermes_autostart.log in WSL)" }
} catch { Warn "could not start now: $_" }

Write-Host ""
Info "DONE. Hermes will now auto-start at every logon/reboot."
Write-Host "  - verify after a reboot: wsl bash -lc 'curl -s http://127.0.0.1:8765/health'"
Write-Host "  - log:                  wsl bash -lc 'cat ~/.hermes_autostart.log'"
Write-Host "  - remove autostart:     Unregister-ScheduledTask -TaskName HermesAutostart -Confirm:`$false"
