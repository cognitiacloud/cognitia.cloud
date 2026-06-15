# BASELINE AUDIT — AUDIT-BOOKLET-001

All values gathered from the repository on the audit branch (not from memory).

## Repo state

- **Repo**: `cognitiacloud/cognitia.cloud`
- **Branch**: `claude/audit-booklet-001-system-booklet`
- **Mainline commit audited**: `313a82d` (_Merge pull request #68 …
  visibility-005-threat-governance_)
- **Working tree**: clean at branch creation.
- **Node**: v22.22.2 · **pnpm**: 10.33.0
- **`pnpm check`**: **515 passed** (format + typecheck + vitest), green.
- **Test files**: 78 (`git ls-files '*.test.ts' | wc -l`).

## Migrations on main (17; 0015 reserved/absent)

0001 tenants/users · 0002 integrations/external maps · 0003 GTM entities ·
0004 events/agent_runs/actions · 0005 campaigns/sequences · 0006 signals/
playbooks/embeddings · 0007 evals/experiments · 0008 credential ciphertexts ·
0009 **Cognitia trust core (agents, ATC, Proof Registry)** · 0010 **SkillProof +
reputation** · 0011 MoverOS lead rescue · 0012 **credits + wallet placeholders** ·
0013 SkillProof/front-desk ext · 0014 wallet binding deactivate · **0015 ABSENT
(reserved for parked COG-016 field provenance)** · 0016 **Agent Economy
(work orders + escrow, simulation-locked)** · 0017 **dispute resolution** ·
0018 **internal marketplace listings**.

> `0019_agent_fabric_nodes.sql` is **NOT on main** — it is in open PR #69
> (LEGEND-001 Agent Fabric Lab), audited here as pending, not mainline.

## Packages / apps

- apps: `api`, `web`, `worker`
- packages: `core`, `db`, `agents`, `integrations`, `workflows`, `evals`

## Public / unauthenticated surfaces (only two reads)

- `GET /health`, `GET /public/trust-feed`. Webhook/own-auth: `POST
/webhooks/hubspot` (HMAC), `POST /webhooks/inbound-lead`, `POST /jobs/crm-sync`.
- **96** session-authenticated operator routes (`sendAuthed`).

## Web pages (apps/web/src/app)

`/trust`, `/trust/live`, `/agent-economy`, `/agents`, `/agents/[id]`,
`/approvals`, `/cognitia`, `/cognitia/crypto-readiness`, `/credits`, `/proofs`,
`/skills`, `/moveros`, `/moveros/front-desk`.

## Docs inventory (Cognitia)

- `docs/cognitia/public/` (18): API_AND_SURFACES, CLAIMS_WE_DO_NOT_MAKE,
  DISCOVERABILITY_PLAN, GOVERNANCE_POSTURE, PUBLIC_EVIDENCE_MANIFEST_SPEC,
  PUBLIC_TRUST_FEED_HARDENING, PUBLIC_TRUST_FEED_RATE_LIMIT_PLAN,
  RESEARCHER_ENTRYPOINTS, RESEARCHER_FAQ, RESEARCHER_PACK, RESEARCHER_REVIEW_ORDER,
  RISK_REGISTER_PUBLIC, STANDARDS_ALIGNMENT, THREAT_MODEL, TOKEN_STATUS_AND_GATES,
  TRUST_BOUNDARIES, TRUST_PROOF_EXPLORER_SPEC, VERIFY_IT_YOURSELF.
- `docs/cognitia/` top-level: ARCHITECTURE_LOCK_V1_1, CREDITS_AND_WALLET_PLACEHOLDERS,
  CRYPTO_READINESS_INTERNAL, IMPLEMENTATION_COMMAND_BOOK, PUBLIC_DILIGENCE_OVERVIEW,
  TENANT_MAP.
- `docs/cognitia/crypto/`: TOKEN_GATES, TOKEN_LAB_001_INTERNAL,
  TOKEN_LAB_002_ARCHITECTURE_INTERNAL, TOKEN_UTILITY_MAP.
- `docs/cognitia/agent-economy/`: AGENT_ECONOMY_LAB, WORK_ORDER_MODEL,
  ESCROW_SIMULATION, DISPUTE_RESOLUTION, AGENT_DRIVEN_WORKFLOW, MARKETPLACE,
  CROSS_TENANT_SETTLEMENT_DESIGN.
- `docs/cognitia/research/`: CRYPTO_VISIBILITY_001 set, 12H sprint,
  distributed-agent-fabric (design-only).
- Root `SECURITY.md` present.
- Guard tests: doctrine, researcherPack, apiSurfaces, visibilityDiscoverability,
  threatGovernance.

## Known blockers (verified from docs/state)

Managed-Postgres RLS under a restricted role (needs dev `DATABASE_URL`); no
production deployment; no external audit; no public token (all gates NOT PASSED);
public feed empty by default; COG-016 + migration 0015 parked; TOKEN-LAB-003 not
started.
