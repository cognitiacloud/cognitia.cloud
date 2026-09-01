#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/smrai/.hermes/node/bin:$PATH"
cd /mnt/c/Users/smrai/cognitia-clean-room/repos/cognitia.cloud
echo "node=$(command -v node) $(node -v)"
echo "reviewer=$(command -v codex)"
codex review --uncommitted --title CGD-001
