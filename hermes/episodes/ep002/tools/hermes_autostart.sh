#!/usr/bin/env bash
# =====================================================================
# Bring Hermes back after every reboot. Invoked at Windows logon by the
# "HermesAutostart" scheduled task (see setup_hermes_autostart.ps1).
#
# Idempotent: ensures the venv, then starts the bridge HTTP daemon if it
# isn't already up, and the running daemon keeps the WSL distro warm so
# Claude Desktop's on-demand (stdio) launches of the bridge are instant.
# Logs to ~/.hermes_autostart.log.
# =====================================================================
set -uo pipefail
LOG="$HOME/.hermes_autostart.log"
ts(){ date '+%Y-%m-%dT%H:%M:%S'; }
log(){ echo "$(ts) $*" >> "$LOG"; }

REPO="${HERMES_REPO:-$HOME/cognitia.cloud}"
B="$REPO/hermes/episodes/ep002/tools"
SRV="$B/hermes_bridge/server.py"
PORT="${HERMES_PORT:-8765}"
PY="$REPO/hermes/episodes/ep002/.venv/bin/python"

log "autostart invoked (user=$(whoami) repo=$REPO)"

if [ ! -f "$SRV" ]; then
  log "FATAL: bridge not found at $SRV — run revive_hermes.sh first"
  exit 1
fi

# Ensure the venv exists (build once via the launcher's setup path).
if [ ! -x "$PY" ]; then
  log "venv missing — building via start_bridge.sh --selftest"
  bash "$B/hermes_bridge/start_bridge.sh" --selftest >> "$LOG" 2>&1 || true
fi
[ -x "$PY" ] || PY="$(command -v python3 || echo python3)"

# Already running? (health check)
if curl -s -o /dev/null "http://127.0.0.1:$PORT/health" 2>/dev/null; then
  log "bridge already healthy on 127.0.0.1:$PORT — nothing to do"
  exit 0
fi

# (Re-)auth codex if it's installed but not logged in, so the pipeline works.
if command -v codex >/dev/null 2>&1 && ! codex login status >/dev/null 2>&1; then
  log "codex not authenticated — see fix_codex_auth.sh (needs interactive login)"
fi

log "starting bridge HTTP daemon on 127.0.0.1:$PORT"
nohup "$PY" "$SRV" --http "$PORT" >> "$LOG" 2>&1 &
log "launched pid $! — Hermes should be replying now"
