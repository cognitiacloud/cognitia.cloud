#!/usr/bin/env bash
# =====================================================================
# Cognitia EP002 — HERMES JOB WRAPPER (WSL / Linux)
# Uses Hermes as the local execution layer if available; otherwise falls
# back to the deterministic local runner. Same safety guards either way:
# no fabricated proof, no HeyGen/ElevenLabs credit unless ALLOW_CREDIT_CALLS=true.
#
# Run:  bash hermes/episodes/ep002/tools/run_hermes_ep002.sh           # preview, stop
#       APPROVE=true bash .../run_hermes_ep002.sh                      # final
# =====================================================================
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
JOB="$DIR/hermes_ep002_job.json"
[ -f "$DIR/.env" ] && set -a && . "$DIR/.env" && set +a

# Resolve a Hermes CLI: explicit $HERMES_BIN, else 'hermes' on PATH.
HB=""
if [ -n "${HERMES_BIN:-}" ] && command -v "$HERMES_BIN" >/dev/null 2>&1; then HB="$HERMES_BIN"
elif command -v hermes >/dev/null 2>&1; then HB="hermes"; fi

if [ -n "$HB" ]; then
  echo "[hermes] execution layer found: $HB"
  echo "[hermes] running job: $JOB"
  exec "$HB" run --job "$JOB" "$@"
else
  echo "[hermes] no Hermes CLI found (set HERMES_BIN=/path/to/hermes to use it)."
  echo "[hermes] STATE C -> falling back to the deterministic local runner."
  exec bash "$DIR/run_local_ep002.sh" "$@"
fi
