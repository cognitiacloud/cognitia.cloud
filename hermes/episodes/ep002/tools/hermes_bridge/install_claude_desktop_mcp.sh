#!/usr/bin/env bash
# =====================================================================
# Cognitia EP002 — One-click Claude Desktop MCP installer (WSL/Linux)
# Sets up the WSL bridge venv + deps, self-tests, then safely merges a
# 'hermes' MCP server (command: wsl.exe) into the WINDOWS Claude Desktop
# config (backed up first). If the config can't be found/edited safely,
# it STOPS and prints the exact Windows block to paste.
#
# Run from inside the repo:
#   bash hermes/episodes/ep002/tools/hermes_bridge/install_claude_desktop_mcp.sh
#
# Does NOT render video, call HeyGen/ElevenLabs, spend credits, publish
# Telegram, or delete user files. Config is backed up before any edit.
# =====================================================================
set -uo pipefail
info(){ printf '\033[36m[install]\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m[warn]\033[0m %s\n' "$*"; }
fail(){ printf '\033[31m[abort]\033[0m %s\n' "$*"; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE" && git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO" ]; then
  p="$HERE"; while [ "$p" != "/" ] && [ ! -f "$p/hermes/episodes/ep002/tools/hermes_bridge/server.py" ]; do p="$(dirname "$p")"; done
  REPO="$p"
fi
SERVER="$REPO/hermes/episodes/ep002/tools/hermes_bridge/server.py"
START="$REPO/hermes/episodes/ep002/tools/hermes_bridge/start_bridge.sh"
[ -f "$SERVER" ] || fail "server.py not found at $SERVER — run from inside the repo."
info "repo: $REPO"

# ---- venv + deps + self-test ----------------------------------------
info "setting up bridge venv + deps (via start_bridge.sh)…"
bash "$START" --selftest || warn "self-test reported an issue (continuing)."

# ---- build the Windows MCP server block (command: wsl.exe) ----------
# Claude Desktop is a Windows app, so it must launch the bridge via wsl.exe.
# Use a NON-login shell ('bash -c', not 'bash -lc'): a login shell sources
# /etc/profile + ~/.profile/~/.bashrc, whose banners (MOTD, conda/nvm/pyenv
# init) print to stdout and corrupt the MCP stdio stream -> restart loop.
BLOCK="$(python3 -c "import json,sys; print(json.dumps({'command':'wsl.exe','args':['bash','-c','bash '+repr(sys.argv[1])],'env':{'PYTHONUNBUFFERED':'1'}}))" "$START")"

print_manual(){
  echo
  echo "----- MANUAL PATCH: add under \"mcpServers\" in your Windows Claude config -----"
  python3 -c "import json,sys; print(json.dumps({'hermes': json.loads(sys.argv[1])}, indent=2))" "$BLOCK"
  echo "Windows config path: %APPDATA%\\Claude\\claude_desktop_config.json"
  echo "-------------------------------------------------------------------------------"
  echo
}

# ---- locate the Windows Claude config -------------------------------
CFG="${CLAUDE_CONFIG:-}"
if [ -z "$CFG" ]; then
  mapfile -t DIRS < <(ls -d /mnt/c/Users/*/AppData/Roaming/Claude 2>/dev/null || true)
  if [ "${#DIRS[@]}" -eq 1 ]; then CFG="${DIRS[0]}/claude_desktop_config.json"
  elif [ "${#DIRS[@]}" -eq 0 ]; then
    warn "no Windows Claude config dir found under /mnt/c/Users/*/AppData/Roaming/Claude."
    warn "Claude Desktop may not be installed, or is on another drive. Editing from WSL is not safe — printing manual block."
    print_manual; info "Self-test passed above; paste the block on Windows and restart Claude."; exit 0
  else
    warn "multiple Claude config dirs found: ${DIRS[*]}"
    warn "ambiguous — not editing automatically. Printing manual block."
    print_manual; exit 0
  fi
fi
info "Windows Claude config: $CFG"

# ---- backup + safe JSON merge (python3) -----------------------------
MERGE_RESULT="$(python3 - "$CFG" "$BLOCK" <<'PY'
import sys, json, os, time, shutil
cfg, block = sys.argv[1], json.loads(sys.argv[2])
data = {}
if os.path.exists(cfg):
    try:
        shutil.copy2(cfg, cfg + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))
    except Exception as e:
        print("BACKUP_FAIL:" + str(e)); sys.exit(2)
    try:
        with open(cfg, encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        print("INVALID_JSON"); sys.exit(3)
existing = ", ".join((data.get("mcpServers") or {}).keys())
data.setdefault("mcpServers", {})["hermes"] = block
os.makedirs(os.path.dirname(cfg), exist_ok=True)
with open(cfg, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
print("MERGED|" + existing)
PY
)"
rc=$?
case "$MERGE_RESULT" in
  INVALID_JSON) warn "existing config is not valid JSON — NOT editing it."; print_manual; fail "stopped to avoid corrupting your config." ;;
  BACKUP_FAIL:*) warn "could not back up config — NOT editing it."; print_manual; fail "${MERGE_RESULT#BACKUP_FAIL:}" ;;
  MERGED*) info "merged 'hermes' MCP server (backup saved)."; pre="${MERGE_RESULT#MERGED|}"; [ -n "$pre" ] && info "preserved existing servers: $pre" ;;
  *) warn "unexpected merge result (rc=$rc)."; print_manual; fail "apply the manual patch above." ;;
esac

# ---- done -----------------------------------------------------------
echo
info "INSTALL COMPLETE."
echo "Next:"
echo "  1. FULLY QUIT Claude Desktop (tray -> Quit), then reopen it."
echo "  2. First prompt to send Claude:"
echo "       Call hermes.status and tell me if Hermes bridge is reachable."
echo "  (Allow the 'hermes' server if a tool-permission prompt appears.)"
