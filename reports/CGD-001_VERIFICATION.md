# CGD-001 VERIFICATION

Command: `scripts/cgd-001-run-tests.sh` which runs workspace `test` (vitest run)
via WSL PATH `/home/smrai/.hermes/node/bin` after `install --frozen-lockfile`
when vitest is missing.

Result (CognitiaFury / WSL, 2026-09-01 ~10:16 PT):
- Test Files: 94 passed (94)
- Tests: 632 passed (632)
- Duration: 92.60s
- Network: CGD-001 gate tests stub fetch; a fetch call fails the packet test.
- No real HubSpot or Salesforce HTTP was issued by those tests.

CGD-001-specific files:
- packages/core/src/liveOutbound.test.ts (4)
- packages/integrations/src/liveOutbound.gate.test.ts (6)
- apps/api/src/cgd001.miraExecute.test.ts (1)
- apps/worker/src/outbound.test.ts (1)

Fixture FakeHubspotClient execute tests still pass (not live).
Existing HttpHubspotClient write-protocol tests opt in via vitest stubEnv only
inside those describes; committed .env.example flags remain false.

Not verified here: production deploy, live HubSpot portal, live Salesforce org,
real SMS provider. This packet does not claim those.
