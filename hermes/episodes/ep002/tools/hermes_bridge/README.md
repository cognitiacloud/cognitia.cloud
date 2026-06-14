# Hermes Bridge — local MCP server for Claude ↔ Hermes/Codex pipeline

Lets Claude Desktop / Claude Code call your local Cognitia Ep-002 pipeline as
tools — read status, search assets, run jobs, render/QC, fetch artifacts — with
back-and-forth execution and **no manual file hunting**.

- **Local only.** MCP runs over **stdio** (Claude launches the process and talks
  on its pipes) — there is **no open port, nothing exposed publicly**. The HTTP
  fallback binds **127.0.0.1 only**.
- **Safe by default.** Read-only/copy-only. Never moves/deletes user files.
  Every action is appended to `bridge.log`.
- **Gated.** 60s final render, Telegram publish, and HeyGen/ElevenLabs credit
  use **refuse unless `confirm=true`** (+ the matching env flags).

## Tools exposed to Claude
| Tool | Action | Gated? |
|---|---|---|
| `hermes.status` | branch/commit, Hermes+Codex detection, real-vs-placeholder slots, artifacts | no (read) |
| `hermes.search_assets` | search local folders for candidate media (`query`, `slot`) | no (read) |
| `hermes.render_preview` | render all-real V7 12s preview → `out/preview_real.mp4` | no (safe) |
| `hermes.qc` | `vision_skill` QC on an image (`mode=privacy\|frameqc\|analyze`) | no (read) |
| `hermes.get_artifacts` | list `out/` artifacts | no (read) |
| `hermes.run_job` | resolve→derive→QC→preview; `approve`/`allow_credit_calls`/`send_telegram` | **confirm=true** |

## Setup
1. Clone the repo locally and check out the branch:
   ```
   git checkout claude/cognitia-episode-002-rebuild-5ffai
   ```
2. (Optional) detect/point Hermes + Codex: set `HERMES_BIN` in
   `tools/.env`; ensure `codex` is on PATH (the bridge auto-detects both and
   reports them in `hermes.status`).
3. Install + self-test:
   - **WSL:** `bash hermes/episodes/ep002/tools/hermes_bridge/start_bridge.sh --selftest`
   - **Windows:** `powershell -ExecutionPolicy Bypass -File .\hermes\episodes\ep002\tools\hermes_bridge\start_bridge.ps1 --selftest`
   (creates `.venv`, installs `mcp pillow numpy imageio-ffmpeg`, prints status JSON)

## Start the bridge
- **For Claude Desktop / Claude Code** you do NOT start it manually — Claude
  launches it from the MCP config (stdio). Just add the config below and restart.
- **Manual / HTTP fallback test:**
  - WSL: `bash .../hermes_bridge/start_bridge.sh --http`  → `http://127.0.0.1:8765`
  - Windows: `...\start_bridge.ps1 --http`

## Claude Desktop config
Edit `claude_desktop_config.json`
(Windows `%APPDATA%\Claude\`, macOS `~/Library/Application Support/Claude/`),
merge a block from `claude_desktop_config.example.json` (replace
`ABSOLUTE_REPO_PATH`), then restart Claude Desktop. Claude Code: add the same
server via `claude mcp add` or your project `.mcp.json`.

```json
{
  "mcpServers": {
    "hermes-wsl": {
      "command": "wsl.exe",
      "args": ["bash", "-c", "bash '/ABSOLUTE_REPO_PATH/hermes/episodes/ep002/tools/hermes_bridge/start_bridge.sh'"],
      "env": { "PYTHONUNBUFFERED": "1" }
    }
  }
}
```

## Test commands
```bash
# harmless status (no render, no network)
bash .../hermes_bridge/start_bridge.sh --selftest
# via HTTP fallback:
bash .../hermes_bridge/start_bridge.sh --http &
curl -s http://127.0.0.1:8765/health
curl -s -X POST http://127.0.0.1:8765/hermes.status
curl -s -X POST http://127.0.0.1:8765/hermes.search_assets -d '{"slot":"heygen"}'
```
In Claude, after adding the MCP server, ask: *"call hermes.status"* — you should
get the project status JSON.

## Troubleshooting
- **Server keeps restarting / "shutting down again and again"** → almost always
  *stdout contamination* of the MCP stdio channel. stdout must carry ONLY
  JSON-RPC. Causes & fixes:
  - **Login-shell banner:** the MCP config must use `bash -c` (NOT `bash -lc`).
    A login shell sources `/etc/profile` + `~/.profile`/`~/.bashrc`, whose
    banners (Ubuntu MOTD, conda/nvm/pyenv init) print to stdout. Re-run the
    installer or edit your config to drop the `-l`.
  - **Setup output:** older launchers leaked `pip`/venv output to stdout. The
    current `start_bridge.sh`/`.ps1` redirect all setup to stderr — make sure
    you're on the updated scripts.
  - **Find the real reason:** open `bridge.log` next to `server.py`. Startup and
    any fatal traceback are recorded there (look for `fatal`/`startup` lines).
- **`missing dependency 'mcp'`** → run a launcher once (installs it) or
  `pip install -r requirements.txt`.
- **Tool not visible in Claude** → restart Claude Desktop after editing config;
  confirm the absolute paths; check `bridge.log`.
- **`hermes`/`codex` show null in status** → set `HERMES_BIN` / add `codex` to
  PATH; the pipeline still runs via the deterministic fallback.
- **Windows can't find python** → install Python 3, or point the config
  `command` at a full `python.exe` path.
- **Permission prompts for gated actions** → that's intended; re-call
  `hermes.run_job` with `confirm=true` to authorize 60s/credits/telegram.

## What it does NOT do
No public exposure, no file deletion/move, no 60s final / Telegram / credit
calls without `confirm=true`, no fabricated proof. Preserves your git branch and
PR state (it only reads git; rendering writes to `out/` which is git-ignored).
