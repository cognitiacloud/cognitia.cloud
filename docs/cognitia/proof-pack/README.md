# Cognitia v1.1 — Proof Pack

Date: 2026-06-11. Every claim tagged. Reproduce any of it with the commands below.

## Project summary

Cognitia v1.1 extends an existing production-shaped multi-tenant platform
(Fastify + Next.js + Kysely/Postgres-RLS) into the first vertically-proven
agent trust layer: ATC-credentialed agents doing MoverOS lead-rescue work
under human approval, with an append-only evidence-tagged Proof Registry,
SkillProof certification, verified-fact-only reputation, internal credits,
and a legal-gated crypto posture.

## PR stack (MERGED 2026-06-11, in order)

#32 → #33 → #34 → #35 → #36 → #37 → #38, all merged; merged base verified
green. Details + merge commits: `PR_STACK.md`.

## Test counts (verified_fact)

Final: **400 tests / 63 files green** (`pnpm check`) on the fully merged
platform base, additionally confirmed by a live HTTP smoke of the whole trust
loop against the booted API (see `../execution/POST_MERGE_VERIFICATION.md`).

## Routes / pages built (v1.1 additions)

- API: proofs (5 routes), agents/ATC/permissions (9), reputation (2),
  skills/SkillProof (7), leads/front-desk (8), credits/wallet/readiness (8),
  command summary (1).
- Console: /cognitia (command dashboard), /proofs, /agents, /agents/[id],
  /skills, /moveros/front-desk, /credits, /cognitia/crypto-readiness.

## Core doctrine (enforced, not aspirational)

Evidence tags on everything; only `verified_fact` adds reputation (DB trigger

- mirror + tests); proofs append-only with supersede chains; `public_safe`
  requires a passed PII redaction scan; ATC revocation terminal; SkillProof
  tier ≥ 2 requires verified_fact; SMS simulation-first with deny-by-default
  real sends; internal credits only; crypto legal-gated.

## verified_fact

All build/test claims in `VERIFICATION_MATRIX.md` marked verified_fact were
executed in-session with green results, against the in-memory repo AND real
Postgres semantics (PGlite) where DB invariants are involved.

## likely_inference

The 19 seeded Core skills describe real founder assets; the soc-1 platform
lineage is the founder's intended base (ratified implicitly by this build).

## unknown

Live database state (no hosted Postgres verified); external Hermes skill
sources; pilot-customer commitments.

## Standing statements

- **No token marketing exists** — guard tests scan routes, pages, and docs.
- **No real payments** — internal_credits rail only, check-locked at the DB.
- **No real SMS** — no provider, deny-by-default permission, owner-gated,
  simulation flag enforced, ledger has no SMS adapter.
- **PII protection** — raw customer data exists only AES-256-GCM-encrypted in
  `lead_intakes`, masked in every list, purgeable (PIPEDA/BC PIPA), and
  blocked from public proofs by the redaction scanner.

## Merge order & next steps

See `../execution/MERGE_READINESS.md` and `../execution/V1_1_FINAL_HANDOFF.md`.

## Reproduce

```bash
pnpm install && pnpm check
pnpm vitest run apps/api/src/missionLoop.e2e.test.ts   # the full trust loop
pnpm vitest run apps/api/src/commandSummary.test.ts    # dashboard + doc guards
```
