#!/usr/bin/env bash
# =====================================================================
# Repair the OpenAI Codex CLI "provider authentication error" that
# breaks the Hermes pipeline after a `codex login`.
#
# Run in WSL (where Hermes/codex live):
#   bash hermes/episodes/ep002/tools/fix_codex_auth.sh
#
# Safe + idempotent: it never deletes your dotfiles. It fixes file
# ownership, neutralizes a stale OPENAI_API_KEY for a clean re-login,
# reports exactly where any stale key is set, and re-authenticates.
# =====================================================================
set -uo pipefail
say(){  printf '\033[36m[fix-codex]\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m[warn]\033[0m %s\n' "$*"; }

CODEX_DIR="${CODEX_HOME:-$HOME/.codex}"
say "user=$(whoami)  HOME=$HOME  CODEX_HOME=$CODEX_DIR"

# 1) Diagnose ----------------------------------------------------------
say "current codex state:"
ls -la "$CODEX_DIR" 2>/dev/null || warn "no $CODEX_DIR yet"
echo "--- config.toml ---"; cat "$CODEX_DIR/config.toml" 2>/dev/null || echo "(none)"
echo "--- OPENAI/CODEX env ---"; env | grep -iE 'OPENAI|CODEX' || echo "(none set)"
echo "--- codex version ---"; command -v codex >/dev/null && codex --version || warn "codex not on PATH"

# 2) Fix ownership if it's root-owned (common after 'sudo codex login') -
if [ -e "$CODEX_DIR" ]; then
  owner="$(stat -c %U "$CODEX_DIR" 2>/dev/null || echo '?')"
  if [ "$owner" != "$(id -un)" ]; then
    warn "$CODEX_DIR is owned by '$owner', not '$(id -un)' — fixing"
    sudo chown -R "$(id -un):$(id -gn)" "$CODEX_DIR" || warn "chown failed; rerun: sudo chown -R \$USER:\$USER $CODEX_DIR"
  fi
fi

# 3) Neutralize a stale OPENAI_API_KEY (the #1 cause: it overrides the
#    ChatGPT login). We DON'T edit your dotfiles — we just report where
#    it's set and unset it for this repair so the login can take effect.
key_files="$(grep -rilE 'OPENAI_API_KEY' "$HOME/.bashrc" "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.zshrc" 2>/dev/null || true)"
if [ -n "${OPENAI_API_KEY:-}" ] || [ -n "$key_files" ]; then
  warn "OPENAI_API_KEY is present — this overrides 'codex login' and usually IS the error."
  [ -n "$key_files" ] && warn "  it is set in: $key_files"
  warn "  -> if that key is stale, remove/comment that line after this script confirms login works."
  unset OPENAI_API_KEY
  say "unset OPENAI_API_KEY for this run"
fi

# 4) Flag a config that pins a provider needing its own key ------------
if [ -f "$CODEX_DIR/config.toml" ] && grep -qiE '^[[:space:]]*model_provider[[:space:]]*=' "$CODEX_DIR/config.toml"; then
  warn "config.toml pins a provider: $(grep -iE '^[[:space:]]*model_provider' "$CODEX_DIR/config.toml" | head -1 | tr -d ' ')"
  warn "  if login still fails, that provider needs its own API key (its 'env_key' in config.toml)."
  say "to test against the default OpenAI provider, temporarily park it:"
  say "  mv \"$CODEX_DIR/config.toml\" \"$CODEX_DIR/config.toml.bak\"   # restore later with mv back"
fi

# 5) Fresh login + verify ----------------------------------------------
say "running 'codex login' — open the URL it prints and sign in with your Codex/ChatGPT account…"
codex login || warn "codex login returned nonzero (see message above)"
echo "--- auth status ---"
codex login status 2>&1 || codex whoami 2>&1 || warn "could not query status"

say "DONE. If status says authenticated, verify Hermes sees codex:"
say "  bash $(dirname "$0")/hermes_bridge/start_bridge.sh --selftest"
