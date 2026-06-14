# V-4 Trust / Proof Explorer — Handoff

Date: 2026-06-14. Branch `claude/v4-trust-proof-explorer`. Status: built,
guarded, full gate green.

## What exists now

A public-safe, read-only researcher surface at **`/trust`** that states —
conservatively and with evidence tags — what Cognitia has built, what is
runtime-verified, what is design-only, what is blocked, the token gate panel
(all gates No / Not passed), 12 evidence cards, a researcher FAQ, and an
explicit "what Cognitia does not claim". Backed by `trust.test.ts` (11
guards) and `public/TRUST_PROOF_EXPLORER_SPEC.md` + `public/RESEARCHER_FAQ.md`.

## Invariants a future change must not break (all test-enforced)

1. Static + read-only: no `'use client'`, no API client, no `fetch(`, no
   state, no token paste. If you ever add a live feed, it must be a separate
   authed, redaction-gated read API — never inline private state here.
2. No purchase CTA, no pre-sale/drop language, no price/return copy, no
   DEX/liquidity/staking/yield marketing (status disclosure only).
3. No private proof bodies / PII / internal fields.
4. Token gates render No / Not passed; the required verbatim token sentence
   stays present; the managed-Postgres RLS caveat stays visible.
5. Keep the page's numbers in sync with the merged status docs (test asserts
   `443/443` and `0015 reserved/absent` — update both together when reality
   moves).

## How to update when reality changes

- Managed-Postgres RLS run completes (V-6) → update the Runtime Verification
  panel + the `Managed-Postgres RLS gate` row + the test's expected strings.
- Test count changes → update the `443/443` constant and the test.
- A card's status changes (e.g., cross-tenant settlement gets built) → update
  the card `status` + `evidence` + this handoff.

## Follow-ups (proposed, gated)

- **V-4b** — live, redaction-gated public proof feed (read-only API serving
  ONLY `public_safe` projections) wired into `/trust`. Needs founder go.
- **V-2** — public team page (founder identity sign-off).
- **V-5 / V-6** — external security audit; managed-Postgres RLS run.

## Guardrails respected

Read-only; no public token launch; no purchase CTA; no DEX/liquidity/
staking/yield; no price/return; no pre-sale; no mainnet; no real payments;
no token transfers; no production migrations; no deploys; no GTM PR work;
no COG-016; no TOKEN-LAB-003.
