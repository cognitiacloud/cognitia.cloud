#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/smrai/.hermes/node/bin:$PATH"
cd /mnt/c/Users/smrai/cognitia-clean-room/repos/cognitia.cloud
pnpm exec vitest run packages/integrations/src/liveOutbound.gate.test.ts packages/core/src/liveOutbound.test.ts apps/api/src/cgd001.miraExecute.test.ts apps/worker/src/outbound.test.ts packages/integrations/src/hubspot/httpClient.test.ts
