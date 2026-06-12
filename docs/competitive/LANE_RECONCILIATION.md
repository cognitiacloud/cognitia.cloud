# Lane Reconciliation — GTM vs Agent-Economy (source of truth)

**Date:** 2026-06-12 · **Author:** GTM lane · **Status:** authoritative reconciliation record.

This repository currently hosts **two structurally divergent lanes** that share
file paths but are **not a clean stack**. This document is the documented source
of truth the operating rules require before either lane adopts the other's
changes to shared infrastructure.

## The two lanes

|                        | **GTM lane (PRIMARY)**                                                     | **Agent-Economy lane**                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                 | `claude/gtm-platform-mvp-setup-vYLBG`                                      | `claude/agent-economy-004-marketplace-matching` (stacked on `…-003`, `…-002`, `…-001`)                                                                                  |
| Thesis                 | CRM-first, approval-gated, governed GTM action system                      | Internal agent economy lab (ATC, proofs, skills, work orders, marketplace)                                                                                              |
| Migrations past `0008` | `0009_audit_hash_chain`, `0010_agent_passports`                            | `0009_cognitia_trust_core` … `0018_marketplace_listings`                                                                                                                |
| Data-layer tables      | trust-lite: `agent_passports`, `scope_grants`, hash-chained `audit_events` | `agents`, `agent_trust_credentials`, `proofs`, `skills`, `skill_versions`, `reputation_*`, `credits_*`, `work_orders`, `dispute_resolutions`, `marketplace_listings`, … |
| Authorization          | the product thesis (operating-plan §0)                                     | operating-plan **§0a-bis** (explicit, scoped re-authorization)                                                                                                          |

## Dependency status (per the requested form)

- **Exact branch:** GTM = `claude/gtm-platform-mvp-setup-vYLBG`; Agent-Economy = `claude/agent-economy-004-marketplace-matching`.
- **Exact files/primitives GTM depends on from Agent-Economy:** **NONE.** The GTM
  branch contains **zero** agent-economy tables and imports nothing from that
  lane. GTM is self-contained on its own trust-lite stack.
- **Required now, or copy/reimplement safely:** N/A — no dependency exists. GTM
  proceeds on its own backlog (operating-plan §5).
- **Conflict risk for shared files:** **HIGH** (see below).
- **Recommended merge order:** the lanes are **mutually incompatible as-is** and
  must not be auto-merged. An owner-level decision is required first (see
  "Open decision").

## Diverged shared infrastructure (HIGH conflict risk)

Both lanes independently rewrote the same files past the `0008` ancestor. **85
files differ; ~15.8k lines.** Treat every file below as **shared infrastructure
under change-control** — neither lane adopts the other's version without an
explicit reconciliation step recorded here.

- **Migration collision (blocking):** both lanes define **`0009` and `0010`**
  with completely different DDL. They cannot both apply to one database. Any
  reconciliation must renumber one side and rebuild the PGlite harness list.
- **Data layer:** `packages/db/src/{schema.ts, repository.ts, memory.ts,
kysely.ts, repository.contract.ts, kysely.pglite.test.ts, memory.test.ts,
index.ts}` — different `Database` table sets and `Repository` contracts.
- **API:** `apps/api/src/{handlers.ts, server.ts}` — different route surfaces
  (`/agent-economy/*`, `/skills/*`, `/proofs/*` exist only on the economy lane;
  `/passports`, `/scope-grants` only on GTM).
- **Web:** `apps/web/src/lib/apiClient.ts` and the `app/{cognitia,credits,
moveros,proofs,skills}` pages (economy lane only).
- **Doctrine guards:** `packages/core/src/doctrine.guard.test.ts` and the
  economy lane's `skillproof.test.ts` "no public marketplace" guard (which the
  economy lane narrowed to permit its internal `/agent-economy/*` surface).
  These guards encode different assumptions and must be reconciled deliberately.

## Open decision (owner-level, do not resolve silently)

Before any cross-lane merge, the owner must choose the target topology:

1. **Separate products / separate bases** — keep the lanes on independent bases
   (and likely independent databases). Simplest; honors the fence; no merge.
2. **One base, economy behind a flag** — fold the economy schema in as an
   additive, renumbered migration set (`0011+`) gated off by default. Large
   reconciliation; requires merging both data-layer rewrites by hand.
3. **GTM-only** — the economy lab stays an internal spike and is not merged to
   the GTM base at all.

Until this is decided, **the GTM lane keeps building on its own backlog and
does not absorb agent-economy schema, routes, or assumptions.** The
agent-economy lane stays on its own stack (PR #54 and below).

## Rule going forward

- The two lanes must **not** continue to evolve the shared data-layer files
  independently for long. For any change to a file listed above, either (a)
  sequence the work so one lane lands first and the other rebases, (b) isolate
  ownership to one lane, or (c) reconcile immediately and update this document.
- Enterprise safeguards are **never** downgraded to ease a merge: branch
  protection + passing checks before merge, owner approval for high-risk
  changes, least-privilege, regression coverage, and rollback posture all hold
  across any reconciliation.
