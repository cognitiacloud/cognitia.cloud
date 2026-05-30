#!/usr/bin/env bash
# Hermes Bridge launcher (WSL/Linux). Sets up deps and starts the server.
#   bash start_bridge.sh            # MCP stdio (for Claude Desktop / Claude Code)
#   bash start_bridge.sh --http     # localhost HTTP fallback on 127.0.0.1:8765
#   bash start_bridge.sh --selftest # harmless status call, prints JSON, exits
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EP_DIR="$(cd "$HERE/../.." && pwd)"
PY="$EP_DIR/.venv/bin/python"
if [ ! -x "$PY" ]; then python3 -m venv "$EP_DIR/.venv"; PY="$EP_DIR/.venv/bin/python"; fi
"$PY" -m pip install -q --upgrade pip >/dev/null 2>&1
"$PY" -m pip install -q mcp pillow numpy imageio-ffmpeg >/dev/null 2>&1 || true
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a
exec "$PY" "$HERE/server.py" "$@"
