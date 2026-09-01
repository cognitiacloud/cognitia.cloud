# CGD-002 VERIFICATION

Command: `scripts/cgd-002-run-tests.sh` which runs workspace `test` (vitest run)
via WSL PATH `/home/smrai/.hermes/node/bin` after `install --frozen-lockfile`
when vitest is missing.

Result (CognitiaFury / WSL, 2026-09-01 ~10:45 PT):
- Test Files: 95 passed (95)
- Tests: 643 passed (643)
- Duration: 83.13s
- Network: CGD-002 gate tests stub fetch; a fetch call fails the packet test.
- No real HubSpot or Salesforce HTTP was issued by those tests.

Parent CGD-001 write-gate tests still pass (mira execute, HubSpot writes, Salesforce
write stub, webhook outbound, worker outbound POST).

CGD-002-specific files:
- packages/core/src/liveOutbound.test.ts (5; +1 nested read-flag test)
- packages/integrations/src/liveOutbound.gate.test.ts (13; +7)
- apps/worker/src/jobs/crmSync.test.ts (2)
- packages/integrations/src/hubspot/readiness.test.ts live-readiness deny report (1)

Fixture FakeHubspotClient sync tests still pass (not live).
Existing HttpHubspotClient read-protocol tests opt in via vitest stubEnv only
inside those describes; committed .env.example flags remain false.

Not verified here: production deploy, live HubSpot portal, live Salesforce org,
real OAuth token endpoint. This packet does not claim those.
