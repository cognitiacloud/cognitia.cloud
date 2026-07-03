# 15 — Claude / Fable Code Execution Prompt

You are Claude/Fable Code working inside this repository branch. Hermes has packaged context. You are the builder.

## First actions

1. Verify visibility: current branch, `package.json`, and this folder.
2. Inspect repo structure before editing.
3. Identify existing Demandara, Cognitia, agents, integrations, policy, ledger, approval, and proof packages.
4. Choose the narrowest implementation path that fits repo conventions.

## Build tasks

Build or extend local/mock-only code for:

1. Demandara data model: lead, vertical, source rights, consent, qualification, approval, connector writeback intent, proof receipt, command center summary.
2. Vertical adapter interface: Budget Wheels DealerOS first; MoverOS pattern as reference only; Skillocate, Alpha Investo, and future verticals as docs/types only if needed.
3. Sales Closer workflow engine: intake, qualify, consent/source-rights gate, human approval, mock writeback, proof receipt.
4. Demand Gen engine skeleton: SEO/AEO/AIO opportunity object, proof-backed content brief, monthly proof report input.
5. Alta-style agent system: prospecting/inbound/revenue intelligence concepts with no live prospecting or outbound action.
6. Cognitia proof integration: policy gate, action ledger event, proof receipt schema, blocked reason.
7. Connector registry: mock-only default, deny live states, explicit approval requirement.
8. Model-router brain harness: mock/replay route, disabled live provider state, fail-closed route result.
9. Agent economy compatibility: agent passport/work event types only; no token/crypto/payment implementation.
10. Command Center UI/data surface: workflow state, approvals, blockers, proof receipt id, next action.
11. Tests and docs: blocked paths, happy path mock-only, forged approval blocked, missing consent blocked, no-live connector blocked, proof receipt generated.

## Absolute prohibitions

No live action. No provider/API calls. No real CRM action. No prospect/customer contact. No secrets or raw env access. No raw PII. No public claims. No deployment. No production migration. Do not change canon.

## Output expected

Report files changed, tests run with exact output, local-only proof of blocked live actions, remaining blockers, evidence label, and no-action ledger confirming no live/provider/CRM/prospect/customer/deploy action.
