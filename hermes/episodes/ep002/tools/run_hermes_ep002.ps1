<#
  Cognitia EP002 — HERMES JOB WRAPPER (Windows PowerShell)
  Uses Hermes as the local execution layer if available; otherwise falls back
  to the deterministic local runner. Same safety guards either way.

  Run:  .\hermes\episodes\ep002\tools\run_hermes_ep002.ps1            # preview, stop
        .\hermes\episodes\ep002\tools\run_hermes_ep002.ps1 -Approve   # final
#>
param([switch]$Approve)
$ErrorActionPreference = 'Stop'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$JOB = Join-Path $DIR 'hermes_ep002_job.json'

# load .env
$envFile = Join-Path $DIR '.env'
if (Test-Path $envFile) { Get-Content $envFile | Where-Object {$_ -match '='} | ForEach-Object {
  $k,$v = $_ -split '=',2; if ($k -and $k[0] -ne '#') { Set-Item "env:$($k.Trim())" $v.Trim() } } }
if ($Approve) { $env:APPROVE = 'true' }

# Resolve a Hermes CLI: explicit $env:HERMES_BIN, else 'hermes' on PATH.
$HB = $null
if ($env:HERMES_BIN -and (Get-Command $env:HERMES_BIN -ErrorAction SilentlyContinue)) { $HB = $env:HERMES_BIN }
elseif (Get-Command hermes -ErrorAction SilentlyContinue) { $HB = 'hermes' }

if ($HB) {
  Write-Host "[hermes] execution layer found: $HB" -ForegroundColor Cyan
  Write-Host "[hermes] running job: $JOB" -ForegroundColor Cyan
  & $HB run --job $JOB
} else {
  Write-Host "[hermes] no Hermes CLI found (set HERMES_BIN to use it)." -ForegroundColor Yellow
  Write-Host "[hermes] STATE C -> falling back to the deterministic local runner." -ForegroundColor Yellow
  $runner = Join-Path $DIR 'run_local_ep002.ps1'
  if ($Approve) { & $runner -Approve } else { & $runner }
}
