# Verify the Hermes Bridge install (Claude Desktop)

One-click installers (back up config, merge safely, preserve existing servers,
self-test). They never render video, call HeyGen/ElevenLabs, spend credits,
publish Telegram, or delete files.

## Run the installer

### Windows (recommended one command)
```powershell
powershell -ExecutionPolicy Bypass -File .\hermes\episodes\ep002\tools\hermes_bridge\install_claude_desktop_mcp.ps1
```
Prefers the WSL bridge if WSL is installed, else native Windows.

### WSL / Linux
```bash
bash hermes/episodes/ep002/tools/hermes_bridge/install_claude_desktop_mcp.sh
```
Merges into the Windows Claude config under
`/mnt/c/Users/<you>/AppData/Roaming/Claude/`. If it can't find it unambiguously,
it STOPS and prints a manual block to paste.

## What success looks like
- `[install] self-test (…)` prints a `"ok": true` status JSON.
- `[install] merged 'hermes' MCP server into …claude_desktop_config.json`
- `[install] preserved existing servers: …` (if you had any)
- A backup file appears next to the config: `claude_desktop_config.json.bak-YYYYMMDD-HHMMSS`.

## Restart + first test
1. **Fully quit** Claude Desktop (system tray → Quit) and reopen it. (A window
   close is not enough — it must restart to load MCP servers.)
2. Send Claude this prompt:
   ```
   Call hermes.status and tell me if Hermes bridge is reachable.
   ```
3. Expected: Claude calls `hermes.status` and returns JSON with your repo branch,
   commit, renderer presence, and real-vs-placeholder slots.

## Manual verification (optional)
```bash
# harmless status, no render/network:
bash hermes/episodes/ep002/tools/hermes_bridge/start_bridge.sh --selftest
# localhost HTTP fallback:
bash hermes/episodes/ep002/tools/hermes_bridge/start_bridge.sh --http &
curl -s -X POST http://127.0.0.1:8765/hermes.status
```
Windows native:
```powershell
& "$env:LOCALAPPDATA\..\..\<repo>\hermes\episodes\ep002\.venv\Scripts\python.exe" `
  ".\hermes\episodes\ep002\tools\hermes_bridge\server.py" --selftest
```

## Available tools after restart
`hermes.status` · `hermes.search_assets` · `hermes.render_preview` ·
`hermes.qc` · `hermes.get_artifacts` · `hermes.run_job`
(`run_job` refuses 60s final / Telegram / credit use unless `confirm=true`).

## Troubleshooting
| Symptom | Fix |
|---|---|
| Tools don't appear | Fully quit + reopen Claude Desktop; re-check the config path; look at `bridge.log`. |
| `missing dependency 'mcp'` | Run `start_bridge.sh`/`.ps1` once (installs it), or `pip install -r requirements.txt`. |
| Installer said "not valid JSON" | It refused to edit. Fix your existing config or paste the printed manual block, then restart. |
| Multiple Claude users / drives | WSL installer prints a manual block — paste it into the right user's config. |
| `wsl.exe` errors in Claude | Ensure a default WSL distro: `wsl --set-default <distro>`; or rerun the PS installer to use the native Windows bridge. |
| `hermes`/`codex` show null | Optional. Set `HERMES_BIN` / add `codex` to PATH; pipeline still runs via deterministic fallback. |

## Rollback
Restore the timestamped backup:
```
Copy-Item "$env:APPDATA\Claude\claude_desktop_config.json.bak-YYYYMMDD-HHMMSS" `
          "$env:APPDATA\Claude\claude_desktop_config.json" -Force
```
Then restart Claude Desktop.

## Safety recap
Local stdio (no public port) · config backed up before edit · existing servers
preserved · copy-only, no deletes · 60s render / Telegram / credits gated behind
`confirm=true` · current git branch + PR state untouched.
