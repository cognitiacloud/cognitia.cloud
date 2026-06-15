# Next Prompts for Agents (economy track)

Date: 2026-06-12. Ready-to-issue mission prompts for follow-up sessions.
Standing guardrails on all: no public token/coin surface, no DEX/liquidity/
staking/yield pages, no price/return language, no real payments, no token
transfers, no production deploys/migrations, no secrets printed, doctrine
guards green, evidence tags on all claims.

> Merge note: the open GTM PR #45 also creates a file with this name carrying
> GTM-track prompts (COG-013/014/015). When both land, UNION the two —
> nothing conflicts semantically.

## ~~LEGEND-001 — Agent Fabric Lab (simulation)~~ EXECUTED 2026-06-15

Built on `claude/legend-001-agent-fabric-lab`. Turned the design-only
distributed-agent-fabric Stage 1 into a runtime-verified, **simulation-only**
lab: migration 0019 `fabric_nodes` (registry, platform/status check-locked,
quarantine kill switch, RLS); twin repo + contract on memory + PGlite; service
`apps/api/src/agentFabric.ts` (deterministic router + `simulateExecute` that
records a verified_fact receipt proof — reuses Proof Registry, no new kind — and
delivers via the existing economy path; owner `verify` still releases escrow);
operator-authed `/agent-fabric/` routes; containment guard
(`packages/core/src/agentFabric.guard.test.ts`: no child_process/net/http/spawn/
fetch). No remote execution, no network, no token, no real payments. Networked
nodes / Tailscale / out-of-process execution remain design-only + gated. YouTube
reconciliation re-probed: still egress-blocked (403), pending founder transcript.
`pnpm check` 525/525, 80 files.

## ~~VISIBILITY-005 — Threat Model + Governance + Risk Register~~ EXECUTED 2026-06-15

Built on `claude/visibility-005-threat-governance`. Added public-safe
`public/THREAT_MODEL.md` (assets/adversaries/trust-boundaries/mitigations/gaps),
`public/GOVERNANCE_POSTURE.md` (founder/operator controlled; no DAO; no token
governance; future items legal/usage/security-gated), `public/TRUST_BOUNDARIES.md`
(what crosses = public-safe projection only; what never crosses = PII/details_private/
secrets/keys), `public/RISK_REGISTER_PUBLIC.md` (open risks + status + next step).
Linked from `/trust`, entrypoints, review order, researcher pack, diligence
overview. Guard `threatGovernance.guard.test.ts` (negation-aware). Docs + guard
only; no schema/migration/deploy; gates remain NOT PASSED.

## ~~VISIBILITY-004 — Public API & Surfaces reference~~ EXECUTED 2026-06-14

Built on `claude/visibility-004-api-surface-reference`. `public/API_AND_SURFACES.md`
(real routes from server.ts; auth model; only two unauth reads; no token/payment
endpoints) + `apiSurfaces.guard.test.ts`. Linked from entrypoints.

## ~~VISIBILITY-003 — Public Diligence Discoverability~~ EXECUTED 2026-06-14

Built on `claude/visibility-003-diligence-discoverability`. Wired the researcher
pack to be findable: README "Trust & diligence" section (links `/trust`,
`SECURITY.md`, RESEARCHER_PACK/VERIFY_IT_YOURSELF/TOKEN_STATUS_AND_GATES/
CLAIMS_WE_DO_NOT_MAKE); `/trust` diligence metadata (title "Cognitia Trust &
Proof"); new `public/RESEARCHER_ENTRYPOINTS.md` + `public/DISCOVERABILITY_PLAN.md`;
guard test `visibilityDiscoverability.guard.test.ts`. Conditional check first
found no safe dev `DATABASE_URL` (all DB env absent) → V-6 deferred. Docs +
README + metadata + guard only; no schema/migration/deploy.

## ~~VISIBILITY-002 — Researcher Pack + Repro Guide + SECURITY.md~~ EXECUTED 2026-06-14

Built on `claude/visibility-002-researcher-pack`. Added repo-root `SECURITY.md`
and `docs/cognitia/public/{RESEARCHER_PACK,VERIFY_IT_YOURSELF,TOKEN_STATUS_AND_GATES,
CLAIMS_WE_DO_NOT_MAKE,RESEARCHER_REVIEW_ORDER,STANDARDS_ALIGNMENT}.md`; linked them
from `/trust` (static, no fetch, no token CTA); added a packages/core guard test
(`researcherPack.guard.test.ts`) + a `/trust` reference assertion. Docs-only; gates
remain NOT PASSED; managed-RLS caveat preserved. Next: founder decisions in
`12H_CRYPTO_VISIBILITY_AGENT_FABRIC/DECISIONS_NEEDED.md` (dev DB for V-6, team page,
default branch, transcript).

## ~~V-5 — Public Trust Feed operational hardening~~ EXECUTED 2026-06-14

Built on `claude/v5-public-trust-feed-hardening`. Bounded the public feed (≤50
proofs via `listProofs({ limit })`), replaced the unbounded reputation read with
a DB aggregate `countReputation` (COUNT/DISTINCT/FILTER, mirrored in-memory),
added freshness/cache metadata + `Cache-Control`, and a secondary
dependency-free in-process rate limiter (`429` + `Retry-After`, fail-open,
env-tunable) with an edge/CDN/WAF runbook as the primary control. No schema, no
migration, no deploy. Docs: `public/PUBLIC_TRUST_FEED_HARDENING.md`,
`public/PUBLIC_TRUST_FEED_RATE_LIMIT_PLAN.md`,
`public/PUBLIC_EVIDENCE_MANIFEST_SPEC.md`. Next public-surface step: enable
`trustProxy` + edge limiting when the feed is published (founder/infra-gated).

## ~~AGENT-ECONOMY-002 — Dispute resolution~~ EXECUTED 2026-06-12

Built on `claude/agent-economy-002-dispute-resolution` (migration 0017, owner
arbitration release/refund/split, append-only records, verified_fact
resolution proofs, honest reputation). The original prompt, for the record:

Build the arbitration path over held escrow: a dispute can be resolved by an
owner decision (release / refund / split) that carries its own structured
reason, emits its own proof (resolution evidence), books reputation honestly
(resolution against the worker → negative; vindication → no positive without
verified_fact), and unblocks the escrow account. New migration widening the
work-order trigger deliberately — never edit 0016. Tests on memory + PGlite.

## ~~AGENT-ECONOMY-003 — Agent-driven accept/deliver~~ EXECUTED 2026-06-12

Built on `claude/agent-economy-003-agent-actions` (ledger asks with ATC +
deny-by-default permission scopes, approval-required, operator execute via
the safe path; verify/resolve never agent-proposable). Original prompt:

Let the WORKER AGENT (not an operator) accept and deliver work orders through
the existing action-ledger approval machinery: agent proposes `economy.accept`
/ `economy.deliver` actions, human approves, execution runs the lab service.
No new trust logic; the point is to prove agent-to-agent flow uses the same
approval discipline as customer-facing actions.

## ~~AGENT-ECONOMY-004 — Marketplace listings + tier-aware matching~~ EXECUTED 2026-06-12

Built on `claude/agent-economy-004-marketplace` (0018 internal-only listings,
evidence-backed tier ranking, order-from-listing wiring into the 003 ledger
asks). Original prompt:

Add the listings/pricing table (internal-visibility check-locked, like 0016's
simulation lock) and matching that ranks by SkillProof tier (tier ≥2
preferred for verified work) + reputation score. Marketplace stays internal;
no public surface.

## ~~AGENT-ECONOMY-005 — Cross-tenant settlement design (doc only)~~ EXECUTED 2026-06-12

Delivered as `agent-economy/CROSS_TENANT_SETTLEMENT_DESIGN.md` on
`claude/agent-economy-005-settlement-design`. Implementation prompts (all
founder-gated, migrations 0019+): clearing-tenant bootstrap, projection
publisher with redaction in the write path, XWO services composing the
existing escrow code, platform arbiter, reconciliation job, exposure caps.
Original prompt:

Internal design doc: what the economy layer spanning tenants means without
breaking RLS — settlement accounts, platform-level escrow, isolation
boundaries. This is the technical half of the multi-tenant token gate
(`docs/cognitia/crypto/TOKEN_GATES.md` #3). No code.

## TOKEN-LAB-003 — S0 local sandbox spike (founder-gated; do not start unprompted)

Throwaway local-chain (e.g. anvil) validation of the TOKEN_LAB_002 §7
interfaces: conserved release/refund/split math and arbiter-only gating, on a
developer-local chain only. Nothing committed except findings as an internal
doc; no toolchain, no contracts directory, no testnet, no value. Entering S1
(Base Sepolia, test tokens) additionally requires founder + counsel sign-off
per the 002 spec §4.

## GTM track (pilot work, unchanged priority rules)

COG-013 (Twilio SANDBOX behind the triple gate), COG-015 (moveros-staging
HTTP integration spike — never shared DB), vertical-aware draft templates:
see PR #45's version of this file; those prompts remain valid for pilot
sessions and run on the proof-environment track.

## ~~V-4 — Trust/Proof Explorer~~ EXECUTED 2026-06-14

Built `/trust` (static, read-only, public-safe) + `trust.test.ts` guards on
`claude/v4-trust-proof-explorer`. Next visibility prompt, founder-gated:

**V-4b — live redaction-gated public proof feed:** a read-only API serving
ONLY `public_safe` (redaction-passed) proof projections + reputation
snapshots, wired into `/trust`. No PII, no private bodies, no token surface.

## ~~V-4b — live redaction-gated public proof feed~~ EXECUTED 2026-06-14

Built `GET /public/trust-feed` (unauthenticated, read-only, config-only
tenant, deny-by-default, public projection + aggregate reputation) and the
`/trust/live` page on `claude/v4b-public-proof-feed`. To publish a demo feed,
set `COGNITIA_PUBLIC_TENANT_ID` to a redaction-checked tenant (founder
decision). Next visibility items remain V-5 (audit) / V-6 (managed RLS),
founder-gated.
