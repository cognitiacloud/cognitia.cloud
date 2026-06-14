<#
  Cognitia EP002 — One-click Claude Desktop MCP installer (Windows)
  Installs the Hermes Bridge into Claude Desktop's config (backed up, merged
  safely, existing servers preserved). Prefers the WSL bridge if WSL is present,
  else native Windows. Runs a harmless self-test.

  Run from inside the repo:
    powershell -ExecutionPolicy Bypass -File .\hermes\episodes\ep002\tools\hermes_bridge\install_claude_desktop_mcp.ps1

  Does NOT: render video, call HeyGen/ElevenLabs, spend credits, publish
  Telegram, or delete user files. Config is backed up before any edit.
#>
$ErrorActionPreference = 'Stop'
function Info($m){ Write-Host "[install] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[warn] $m" -ForegroundColor Yellow }
function Fail($m){ Write-Host "[abort] $m" -ForegroundColor Red; exit 1 }

# ---- locate repo root ------------------------------------------------
$HERE = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO = $null
try { $REPO = (& git -C $HERE rev-parse --show-toplevel 2>$null) } catch {}
if (-not $REPO) {
  $p = $HERE
  while ($p -and -not (Test-Path (Join-Path $p 'hermes\episodes\ep002\tools\hermes_bridge\server.py'))) {
    $parent = Split-Path -Parent $p; if ($parent -eq $p) { break }; $p = $parent }
  $REPO = $p
}
$REPO = (Resolve-Path $REPO).Path
$BRIDGE = Join-Path $REPO 'hermes\episodes\ep002\tools\hermes_bridge'
$SERVER = Join-Path $BRIDGE 'server.py'
$EP_DIR = Join-Path $REPO 'hermes\episodes\ep002'
if (-not (Test-Path $SERVER)) { Fail "server.py not found at $SERVER — run this from inside the repo." }
Info "repo: $REPO"

# ---- choose bridge mode: prefer WSL ---------------------------------
$useWsl = $false; $wslRepo = $null
if (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
  try { $distros = (& wsl.exe -l -q) 2>$null | Where-Object { $_ -and $_.Trim() }
        if ($LASTEXITCODE -eq 0 -and $distros) {
          $wslRepo = (& wsl.exe wslpath -a "$REPO" 2>$null); if ($wslRepo) { $wslRepo = $wslRepo.Trim(); $useWsl = $true } } } catch {}
}

if ($useWsl) {
  Info "WSL detected -> using WSL bridge ($wslRepo)"
  $startSh = "$wslRepo/hermes/episodes/ep002/tools/hermes_bridge/start_bridge.sh"
  # NON-login shell ('bash -c'): a login shell ('bash -lc') sources profile
  # banners (MOTD, conda/nvm/pyenv) that print to stdout and corrupt the MCP
  # stdio stream, sending Claude into a kill/relaunch loop.
  $block = [ordered]@{ command = 'wsl.exe'; args = @('bash','-c',"bash '$startSh'"); env = @{ PYTHONUNBUFFERED = '1' } }
  Info "self-test (WSL)…"
  try { & wsl.exe bash -c "bash '$startSh' --selftest" } catch { Warn "WSL self-test could not run: $_" }
} else {
  Info "no WSL -> using native Windows bridge"
  $PY = Join-Path $EP_DIR '.venv\Scripts\python.exe'
  if (-not (Test-Path $PY)) { Info "creating venv…"; & python -m venv (Join-Path $EP_DIR '.venv') }
  Info "installing requirements…"
  & $PY -m pip install -q --upgrade pip 2>$null
  & $PY -m pip install -q -r (Join-Path $BRIDGE 'requirements.txt')
  $block = [ordered]@{ command = $PY; args = @($SERVER); env = @{ PYTHONUNBUFFERED = '1' } }
  Info "self-test (native)…"
  try { & $PY $SERVER --selftest } catch { Warn "native self-test failed: $_" }
}

# ---- Claude Desktop config (backup + safe merge) --------------------
$CFGDIR = Join-Path $env:APPDATA 'Claude'
$CFG = Join-Path $CFGDIR 'claude_desktop_config.json'
New-Item -ItemType Directory -Force -Path $CFGDIR | Out-Null

function Print-ManualPatch {
  Write-Host "`n----- MANUAL PATCH: add this under `"mcpServers`" in $CFG -----" -ForegroundColor Yellow
  ([ordered]@{ hermes = $block } | ConvertTo-Json -Depth 12)
  Write-Host "-------------------------------------------------------------`n" -ForegroundColor Yellow
}

$json = $null
if (Test-Path $CFG) {
  $bak = "$CFG.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
  Copy-Item $CFG $bak -Force
  Info "backed up existing config -> $bak"
  try { $json = Get-Content $CFG -Raw -Encoding UTF8 | ConvertFrom-Json } catch {
    Warn "existing config is not valid JSON — NOT editing it."; Print-ManualPatch; Fail "stopped to avoid corrupting your config." }
} else {
  $json = [pscustomobject]@{}
  Info "no existing config — creating a fresh one."
}

if (-not ($json.PSObject.Properties.Name -contains 'mcpServers') -or $null -eq $json.mcpServers) {
  $json | Add-Member -NotePropertyName 'mcpServers' -NotePropertyValue ([pscustomobject]@{}) -Force
}
$existing = @($json.mcpServers.PSObject.Properties.Name) -join ', '
$json.mcpServers | Add-Member -NotePropertyName 'hermes' -NotePropertyValue ([pscustomobject]$block) -Force
try {
  ($json | ConvertTo-Json -Depth 12) | Set-Content -Path $CFG -Encoding UTF8
  Info "merged 'hermes' MCP server into $CFG"
  if ($existing) { Info "preserved existing servers: $existing" }
} catch { Warn "could not write config."; Print-ManualPatch; Fail "write failed; apply the manual patch above." }

# ---- done -----------------------------------------------------------
Write-Host ""
Info "INSTALL COMPLETE."
Write-Host "Next:" -ForegroundColor Green
Write-Host "  1. FULLY QUIT Claude Desktop (system tray -> Quit), then reopen it."
Write-Host "  2. First prompt to send Claude:"
Write-Host '       Call hermes.status and tell me if Hermes bridge is reachable.' -ForegroundColor White
Write-Host "  (If a tool-permission prompt appears, allow the 'hermes' server.)"
