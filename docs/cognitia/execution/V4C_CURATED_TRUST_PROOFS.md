# V-4c — Curated Static Public-safe Proof Samples on `/trust`

Date: 2026-06-14. Branch `claude/v4c-curated-trust-proofs` (from `main` @
`79a2df7`). Status: built, guarded, full gate green.

## What was built

A curated, **static** set of public-safe proof samples baked into the repo and
rendered on the static `/trust` page — so an evaluator sees concrete,
evidence-tagged proof entries without any live database exposure.

Pipeline (exactly as scoped):

```
curated public-safe proof entries
  → static TS data (apps/web/src/app/trust/curated-proofs.ts)
  → rendered on /trust (static server component, no fetch)
  → no private proof bodies
  → no PII
  → no tenant / customer data
  → no live DB exposure
```

- **`apps/web/src/app/trust/curated-proofs.ts`** — hand-authored
  `CURATED_PROOFS` plus a `CURATED_PROOF_NOTE` banner. Each entry uses ONLY the
  public projection fields (`id`, `kind`, `evidence_tag`, `summary_public`,
  `supersedes_proof_id`, `created_at`). Ids are synthetic `sample-*` labels —
  never real record ids (which are UUIDs). The set spans all three evidence
  tags and includes a supersession example, so it demonstrates the discipline
  honestly: only `verified_fact` moves reputation / releases value;
  `likely_inference` and `unknown` confer nothing.
- **`apps/web/src/app/trust/page.tsx`** — new "Public-safe Proof Samples"
  section renders the curated entries as a table with an evidence-tag pill,
  the "not live records" note, and a link to the live feed (`/trust/live`).
  The page stays **static** — no `'use client'`, no `fetch`, no API client, no
  DB import — so the V-4 read-only guards remain intact.
- **Tests**: `apps/web/src/app/trust/curated-proofs.test.ts` (8) — public
  projection only; closed evidence-tag taxonomy; verified_fact + a weaker tag
  present; no private fields / PII / UUID ids / emails; ISO dates + valid
  supersession; data module is static (no DB/fetch/env); rendered on `/trust`.

## Why this is safe

The data is authored by hand and committed as source — it cannot leak a real
record because it never touches the database, a tenant, or a request. The
shape is identical to the live feed's public projection, so what an evaluator
sees here is exactly what the live endpoint would ever expose (and nothing
more). The page does not fetch, so `/trust` stays fully static and the V-4
guards (no `'use client'`, no `fetch`, no `apiClient`) continue to hold.

## Relationship to V-4 and V-4b

- **V-4** (`/trust`, merged #59) — static status explorer. V-4c adds a concrete
  proof-sample table to it.
- **V-4b** (`/trust/live` + `GET /public/trust-feed`, PR #60) — the LIVE feed of
  real redaction-passed projections, empty until a public tenant is configured.
  V-4c is the static, always-present counterpart; the two are complementary and
  independent (V-4c branches from `main`, not from #60).

## Results

- `curated-proofs.test.ts`: 8/8.
- Full gate: **`pnpm check` green** (see PR for the exact count).

## Invariants future edits must keep

1. Curated entries stay public-projection-only — never add a private field, a
   real tenant/customer id, an email, or a personal name.
2. Ids stay synthetic `sample-*` labels, never real UUID record ids.
3. The data module stays static — no DB import, no fetch, no env, no request.
4. `/trust` stays static; live data lives only under `/trust/live`.

## Guardrails respected

Read-only; static; no live DB exposure; no public token launch; no purchase
CTA; no DEX/liquidity/staking/yield; no price/return; no pre-sale; no mainnet;
no real payments; no token transfers; no production migrations; no deploys; no
GTM PR work; no COG-016; no TOKEN-LAB-003.
