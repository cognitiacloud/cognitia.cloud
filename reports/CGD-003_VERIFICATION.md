# CGD-003 VERIFICATION

Command: `scripts/cgd-003-run-tests.sh` which runs workspace `test` (vitest run)
via WSL PATH `/home/smrai/.hermes/node/bin` after `install --frozen-lockfile`
when vitest is missing, then `python3 hermes/skills/hubspot-skill/test_hubspot_skill.py`.

Result (CognitiaFury / WSL, 2026-09-01 ~10:57 PT):
- Test Files: 95 passed (95)
- Tests: 647 passed (647)
- Duration: 88.90s
- Hermes hubspot-skill: 42 passed (42) in 0.008s
- Network: CGD-003 gate tests stub fetch/_http_call/urlopen; a real call fails the packet test.
- No real HubSpot or Salesforce HTTP was issued by those tests.

Parent CGD-002 643 tests still pass (647 = 643 + 4 new vitest cases).
Python skill tests include 10 new deny-before-network cases.

CGD-003-specific files:
- packages/core/src/liveOutbound.test.ts (+1 nested connect/skill flag test)
- packages/integrations/src/liveOutbound.gate.test.ts (16; +3)
- hermes/skills/hubspot-skill/test_hubspot_skill.py (42; +10 CGD-003)

Existing HttpHubspotClient / skill protocol tests opt in via stubEnv / _allow_hubspot_skill
only inside those describes; committed .env.example flags remain false.

Not verified here: production deploy, live HubSpot portal, live Salesforce org,
real OAuth token endpoint. This packet does not claim those.
