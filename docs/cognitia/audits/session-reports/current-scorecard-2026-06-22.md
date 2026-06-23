# Current Scorecard — Cognitia / Demandara

- **Run timestamp:** 2026-06-23 01:11 UTC
- **Canonical:** `overnight/gtm-implementation` @ `da48e8f`
- All scores backed by tested builds, passing test suites, route presence, and source evidence (see `real-progress-and-score-audit-2026-06-22.md`).

## Scores (0–100)

| Axis | Score | Evidence |
|------|-------|----------|
| Mock/dry-run capability | **90** | 805 tests pass on trunk; `dryRunChannels` + fail-closed `sendLive` (returns `never`); `/gtm-os-integrated-demo` builds; no-egress attestation |
| Alta parity — canonical overnight | **70** | B1–B6 lanes + integrated demo + #179 gate on trunk; **no Command Center route on trunk** |
| Alta parity — strongest candidate | **84** | alta-90 (mirror CC, 829 tests, builds) / consolidate (real-output CC, 815 tests, builds); neither unifies CC+#179+panels canonically |
| Investor/demo readiness | **68** | demo route ships on trunk, PII-safe, read-only; Command Center only on draft branches |
| Controlled-live readiness | **55** | gate + kill switch + approval≠send + #182 monitoring + rollback exist but scattered across draft/conflicted branches; not one canonical line (cap 80) |
| Actual-live automation readiness | **12** | no legal/customer/deployment/connector approvals (hard cap 30) |
| Enterprise readiness | **45** | RLS + tenant isolation + permission model + 20 PGlite contract tests + threat governance; no SOC2/live deploy |
| SalesCloser superiority | **55** | proof-governed Sales Closer core, mock-safe, tested; no live competitive proof |
| First paid pilot readiness | **35** | demo-ready, mock-only; no live connectors or signed customer |
| Trust/proof moat | **70** | fail-closed gates, no-egress attestations, PII redaction, proofs/trust feed, audit evidence |
| Repo/trunk hygiene | **58** | trunk green + #179/#183 merged cleanly; 8 open drafts, 2 conflicted, CC fragmented across 4 branches |

## Evidence-check results (Step 6)

| # | Claim | Result |
|---|-------|--------|
| 1 | `sendLive` always throws / live send impossible | ✅ `dryRunChannels.ts:144` returns `never`, always throws `LiveSendBlockedError` |
| 2 | controlled_live gate fails closed | ✅ 7 required conditions default `false`; `evaluateReleaseGate` blocks |
| 3 | dry-run actions are `mode:'dry_run'`, `sent:false` | ✅ no `sent:true` anywhere; mock mode enforced |
| 4 | approval ≠ send | ✅ #179 engine: human approval "necessary but not sufficient"; controlled_live still required |
| 5 | kill switch overrides execution | ✅ `automationReleaseGate.ts`: kill switch → `blocked`, overrides everything |
| 6 | no raw PII in serialized demo/CC data | ✅ `.example` only; `gtmIntegratedDemoData.ts:295` defensive PII strip |
| 7 | Command Center read-only, no send/call/SMS/WhatsApp/ad buttons | ✅ server component, "Would send (preview, BLOCKED)", no controls |
| 8 | parity scorecard computed from real outputs, not static mirror | ⚠️ **alta-90 CC = mirror**; only `consolidate-r21oqk` CC uses real `@cognitia/agents` outputs |
| 9 | `/gtm-command-center` and `/gtm-os-integrated-demo` both build | ⚠️ demo builds on trunk; **Command Center builds only on candidate branches**, not canonical |
| 10 | all scores backed by files/tests/routes/commands | ✅ all scores traced to tested commands + source paths |

## Guardrails applied

- No 100s — Command Center not canonical, no live approvals.
- Actual-live ≤ 30 (scored 12).
- Controlled-live ≤ 80 (scored 55 — not integrated on one canonical line).
- Branch-only code (Command Center, #177/#178/#182) scored separately from canonical trunk.
- Docs-only (#181) not scored as implemented behavior.
