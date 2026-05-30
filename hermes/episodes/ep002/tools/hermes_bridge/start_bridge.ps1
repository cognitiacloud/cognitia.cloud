<#
  Hermes Bridge launcher (Windows PowerShell). Sets up deps and starts server.
    .\start_bridge.ps1             # MCP stdio (for Claude Desktop / Claude Code)
    .\start_bridge.ps1 --http      # localhost HTTP fallback on 127.0.0.1:8765
    .\start_bridge.ps1 --selftest  # harmless status call, prints JSON, exits
#>
$ErrorActionPreference = 'Stop'
$HERE = Split-Path -Parent $MyInvocation.MyCommand.Path
$EP_DIR = (Resolve-Path "$HERE\..\..").Path
$PY = "$EP_DIR\.venv\Scripts\python.exe"
if (-not (Test-Path $PY)) { & python -m venv "$EP_DIR\.venv" }
& $PY -m pip install -q --upgrade pip 2>$null
& $PY -m pip install -q mcp pillow numpy imageio-ffmpeg 2>$null
$envFile = Join-Path $HERE '.env'
if (Test-Path $envFile) { Get-Content $envFile | Where-Object {$_ -match '='} | ForEach-Object {
  $k,$v = $_ -split '=',2; if ($k -and $k[0] -ne '#') { Set-Item "env:$($k.Trim())" $v.Trim() } } }
& $PY "$HERE\server.py" @args
