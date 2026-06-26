#!/usr/bin/env bash
# =====================================================================
# Revive the Hermes bridge from scratch — e.g. after a NEW HARD DRIVE
# or fresh OS install, when Hermes "stops replying" because its local
# setup (WSL repo clone, venv, ~/.codex login, Claude Desktop MCP
# config) is gone. Rebuilds everything from the GitHub repo.
#
# Run in WSL:
#   bash revive_hermes.sh                # clone into $HOME if needed
#   bash revive_hermes.sh /path/parent   # clone under a chosen parent dir
#
# Safe: clones/fetches code, builds a venv, re-auths codex, and merges
# the Claude config (which is backed up first). Never deletes user data.
# =====================================================================
set -uo pipefail
say(){  printf '\033[36m[revive]\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m[warn]\033[0m %s\n' "$*"; }
fail(){ printf '\033[31m[abort]\033[0m %s\n' "$*"; exit 1; }

REPO_URL="https://github.com/cognitiacloud/cognitia.cloud.git"
BRANCH="claude/fix-hermes-bridge-stdio-loop"
PARENT="${1:-$HOME}"
REL="hermes/episodes/ep002/tools"
MARKER="$REL/hermes_bridge/server.py"

# 0) prerequisites -----------------------------------------------------
for c in git python3; do
  command -v "$c" >/dev/null 2>&1 || fail "missing '$c' — install first:  sudo apt-get update && sudo apt-get install -y $c"
done
command -v codex >/dev/null 2>&1 || warn "codex CLI not on PATH — install/login later; the pipeline still runs without it."

# 1) locate or clone the repo -----------------------------------------
REPO=""
if [ -f "$PWD/$MARKER" ]; then
  REPO="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
elif [ -f "$PARENT/cognitia.cloud/$MARKER" ]; then
  REPO="$PARENT/cognitia.cloud"
else
  say "no local clone found — cloning fresh into $PARENT/cognitia.cloud"
  mkdir -p "$PARENT"
  git clone "$REPO_URL" "$PARENT/cognitia.cloud" || fail "clone failed (check network / git credentials)"
  REPO="$PARENT/cognitia.cloud"
fi
say "repo: $REPO"
cd "$REPO" || fail "cannot cd into $REPO"

# 2) pull the latest fixed bridge + tools -----------------------------
git fetch origin "$BRANCH" 2>/dev/null && git checkout "origin/$BRANCH" -- "$REL" 2>/dev/null \
  && say "refreshed bridge tools from $BRANCH" \
  || warn "could not refresh from $BRANCH (offline?) — using checked-out version"

# 3) re-auth codex if needed ------------------------------------------
if command -v codex >/dev/null 2>&1; then
  if codex login status >/dev/null 2>&1; then
    say "codex already authenticated"
  else
    warn "codex not authenticated — running auth repair"
    bash "$REL/fix_codex_auth.sh" || warn "codex auth repair incomplete (re-run it manually)"
  fi
fi

# 4) rebuild venv + deps, self-test, and re-register Claude Desktop ----
# install_claude_desktop_mcp.sh creates the venv, installs deps, self-tests,
# and safely merges the 'hermes' server into the Windows Claude config.
say "rebuilding venv + deps and re-registering Hermes in Claude Desktop…"
if [ -f "$REL/hermes_bridge/install_claude_desktop_mcp.sh" ]; then
  bash "$REL/hermes_bridge/install_claude_desktop_mcp.sh" || warn "installer reported an issue — see output above"
else
  warn "installer not found; building venv via start_bridge.sh --selftest instead"
  bash "$REL/hermes_bridge/start_bridge.sh" --selftest || warn "self-test reported an issue"
fi

say "================================================================"
say "REVIVE COMPLETE. Final step (on Windows):"
say "  1. FULLY quit Claude Desktop (tray -> Quit), then reopen it."
say "  2. Ask Claude:  call hermes.status"
say "If hermes.status returns JSON, Hermes is alive again."
say "================================================================"
