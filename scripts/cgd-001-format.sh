#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/smrai/.hermes/node/bin:$PATH"
cd /mnt/c/Users/smrai/cognitia-clean-room/repos/cognitia.cloud
pnpm exec prettier --write \
  packages/core/src/liveOutbound.ts \
  packages/core/src/liveOutbound.test.ts \
  packages/core/src/index.ts \
  packages/integrations/src/hubspot/httpClient.ts \
  packages/integrations/src/hubspot/httpClient.test.ts \
  packages/integrations/src/hubspot/adapter.ts \
  packages/integrations/src/hubspot/provider.ts \
  packages/integrations/src/hubspot/rollback.test.ts \
  packages/integrations/src/hubspot/writePlan.test.ts \
  packages/integrations/src/types.ts \
  packages/integrations/src/index.ts \
  packages/integrations/src/salesforce/write.ts \
  packages/integrations/src/webhookOutbound.ts \
  packages/integrations/src/liveOutbound.gate.test.ts \
  packages/integrations/src/email/adapter.ts \
  packages/agents/src/ledger/actionLedger.ts \
  apps/api/src/handlers.ts \
  apps/api/src/frontdesk.ts \
  apps/api/src/cgd001.miraExecute.test.ts \
  apps/worker/src/outbound.ts \
  apps/worker/src/outbound.test.ts \
  apps/worker/src/index.ts \
  apps/worker/src/jobs/crmSync.ts \
  apps/worker/tsconfig.json \
  .env.example
