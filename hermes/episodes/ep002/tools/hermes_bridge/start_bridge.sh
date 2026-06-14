#!/usr/bin/env bash
# Hermes Bridge launcher (WSL/Linux). Sets up deps and starts the server.
#   bash start_bridge.sh            # MCP stdio (for Claude Desktop / Claude Code)
#   bash start_bridge.sh --http     # localhost HTTP fallback on 127.0.0.1:8765
#   bash start_bridge.sh --selftest # harmless status call, prints JSON, exits
#
# CRITICAL: in stdio mode this is an MCP server — its stdout carries ONLY the
# JSON-RPC protocol. ANY other byte on stdout (pip output, a venv notice, a
# login-shell banner) corrupts the stream and makes Claude kill + relaunch the
# server in a loop. So every setup step below is redirected to stderr (1>&2),
# and the server is the only thing that writes to the real stdout.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EP_DIR="$(cd "$HERE/../.." && pwd)"
PY="$EP_DIR/.venv/bin/python"

{
  # Resolve a base python to build the venv if it doesn't exist yet. We don't
  # rely on a login shell for PATH, so probe the usual locations explicitly.
  if [ ! -x "$PY" ]; then
    BASEPY=""
    for c in python3 python /usr/bin/python3 /usr/local/bin/python3; do
      if command -v "$c" >/dev/null 2>&1; then BASEPY="$(command -v "$c")"; break; fi
      [ -x "$c" ] && { BASEPY="$c"; break; }
    done
    if [ -z "$BASEPY" ]; then
      echo "[hermes-bridge] FATAL: no python3 found; install Python 3 in this WSL distro." >&2
      exit 3
    fi
    echo "[hermes-bridge] creating venv with $BASEPY" >&2
    "$BASEPY" -m venv "$EP_DIR/.venv"
    PY="$EP_DIR/.venv/bin/python"
  fi
  "$PY" -m pip install -q --upgrade pip || true
  "$PY" -m pip install -q mcp pillow numpy imageio-ffmpeg || true
  # Verify the one hard dependency; warn loudly (to stderr / log) if missing.
  if ! "$PY" -c "import mcp" >/dev/null 2>&1; then
    echo "[hermes-bridge] WARNING: 'mcp' not importable after install (offline?). stdio mode will fail; see bridge.log." >&2
  fi
  if [ -f "$HERE/.env" ]; then set -a; . "$HERE/.env"; set +a; fi
} 1>&2

exec "$PY" "$HERE/server.py" "$@"
