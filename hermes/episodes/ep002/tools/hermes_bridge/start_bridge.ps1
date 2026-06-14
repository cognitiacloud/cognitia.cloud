<#
  Hermes Bridge launcher (Windows PowerShell). Sets up deps and starts server.
    .\start_bridge.ps1             # MCP stdio (for Claude Desktop / Claude Code)
    .\start_bridge.ps1 --http      # localhost HTTP fallback on 127.0.0.1:8765
    .\start_bridge.ps1 --selftest  # harmless status call, prints JSON, exits

  CRITICAL: in stdio mode this is an MCP server whose stdout carries ONLY the
  JSON-RPC protocol. pip/venv output on stdout corrupts the stream and sends
  Claude into a kill/relaunch loop. Every setup line below uses '*>&2' to push
  ALL of its output streams to stderr, leaving stdout clean for the server.
#>
$ErrorActionPreference = 'Stop'
$HERE = Split-Path -Parent $MyInvocation.MyCommand.Path
$EP_DIR = (Resolve-Path "$HERE\..\..").Path
$PY = "$EP_DIR\.venv\Scripts\python.exe"
if (-not (Test-Path $PY)) { & python -m venv "$EP_DIR\.venv" *>&2 }
& $PY -m pip install -q --upgrade pip *>&2
& $PY -m pip install -q mcp pillow numpy imageio-ffmpeg *>&2
if (-not (& $PY -c "import mcp" *>$null; $?)) {
  [Console]::Error.WriteLine("[hermes-bridge] WARNING: 'mcp' not importable after install (offline?). stdio mode will fail; see bridge.log.")
}
$envFile = Join-Path $HERE '.env'
if (Test-Path $envFile) { Get-Content $envFile | Where-Object {$_ -match '='} | ForEach-Object {
  $k,$v = $_ -split '=',2; if ($k -and $k[0] -ne '#') { Set-Item "env:$($k.Trim())" $v.Trim() } } }
& $PY "$HERE\server.py" @args
