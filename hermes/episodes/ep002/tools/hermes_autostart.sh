#!/usr/bin/env bash
# =====================================================================
# Bring Hermes back after every reboot. Invoked at Windows logon by the
# Startup-folder launcher (see setup_hermes_autostart.ps1).
#
#   bash hermes_autostart.sh          # ensure venv + start bridge daemon
#   bash hermes_autostart.sh status   # print health JSON (or nothing), exit 0/1
#
# No external deps (no curl): health is checked with Python's stdlib. The
# daemon is detached with setsid so it survives the launching WSL session.
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
VENV_PY="$REPO/hermes/episodes/ep002/.venv/bin/python"
PY="$VENV_PY"; [ -x "$PY" ] || PY="$(command -v python3 || echo python3)"

# Print /health body and exit 0 if the bridge answers, else exit 1. curl-free.
health(){
  "$PY" - "$PORT" <<'PY' 2>/dev/null
import sys, urllib.request
try:
    print(urllib.request.urlopen("http://127.0.0.1:%s/health" % sys.argv[1], timeout=2).read().decode())
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
}

if [ "${1:-}" = "status" ]; then
  out="$(health)" && { echo "$out"; exit 0; } || { exit 1; }
fi

log "autostart invoked (user=$(whoami) repo=$REPO py=$PY)"
[ -f "$SRV" ] || { log "FATAL: bridge not found at $SRV — run revive_hermes.sh first"; exit 1; }

# Build the venv once if missing.
if [ ! -x "$VENV_PY" ]; then
  log "venv missing — building via start_bridge.sh --selftest"
  bash "$B/hermes_bridge/start_bridge.sh" --selftest >> "$LOG" 2>&1 || true
  [ -x "$VENV_PY" ] && PY="$VENV_PY"
fi

if health >/dev/null 2>&1; then
  log "already healthy on 127.0.0.1:$PORT"
  exit 0
fi

log "starting bridge daemon: $PY $SRV --http $PORT"
setsid nohup "$PY" "$SRV" --http "$PORT" >> "$LOG" 2>&1 < /dev/null &
disown 2>/dev/null || true

# Wait briefly for it to bind, then confirm.
for _ in $(seq 1 12); do
  health >/dev/null 2>&1 && break
  sleep 0.5
done
if health >/dev/null 2>&1; then
  log "bridge UP on 127.0.0.1:$PORT"
else
  log "WARN: daemon did not confirm healthy — see the lines above in this log"
fi
