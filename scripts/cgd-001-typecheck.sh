#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/smrai/.hermes/node/bin:$PATH"
cd /mnt/c/Users/smrai/cognitia-clean-room/repos/cognitia.cloud
pnpm run typecheck
