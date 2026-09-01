#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/smrai/.hermes/node/bin:$PATH"
cd /mnt/c/Users/smrai/cognitia-clean-room/repos/cognitia.cloud
echo "node=$(node -v)"
echo "mgr=$(pnpm -v)"
if [ ! -x node_modules/.bin/vitest ]; then
  echo "installing workspace deps"
  pnpm install --frozen-lockfile
fi
pnpm exec vitest run
echo "--- hermes hubspot-skill (offline, network patched) ---"
python3 hermes/skills/hubspot-skill/test_hubspot_skill.py
