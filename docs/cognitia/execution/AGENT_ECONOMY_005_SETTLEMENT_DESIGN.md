# AGENT-ECONOMY-005 — Cross-Tenant Settlement Design (execution record)

Date: 2026-06-12. Branch `claude/agent-economy-005-settlement-design`
(stack: `main` → #48 → #49 → #51 → #52 → this). **Doc-first ticket: zero
code, zero migrations, zero routes.** Evidence: the design itself is
`likely_inference` (it proposes); statements about the built lab are
`verified_fact`.

## Deliverable

`docs/cognitia/agent-economy/CROSS_TENANT_SETTLEMENT_DESIGN.md` — the
technical half of TOKEN_GATES #3 (multi-tenant gate). Core decisions:

1. **Two-ledger clearing model**: per-tenant ledgers stay authoritative; a
   dedicated PLATFORM CLEARING TENANT (itself RLS-scoped — a participant
   with duties, not a backdoor) mirrors conserved reserve/release/refund
   legs with `xwo:` namespaced idempotency keys. No new RLS bypasses; no
   shared DB, ever.
2. **verified_fact-only release survives the boundary** — enforced on the
   clearing ledger via the proof's public_safe projection (the proof body
   never leaves its tenant).
3. **Reputation portability = attestations, never transfers**: derived,
   redaction-checked, reproducible (snapshot inputs_hash) read-only
   projections; events stay tenant-scoped; no global score; never tokenized.
4. **Both-side consent**: B's ledger approves B's worker (003 discipline);
   A's owner verifies payouts; cross-tenant disputes escalate to the
   platform arbiter using 0017 semantics.
5. **Stage ladder** for value: Stage 0 built (single-tenant credits) →
   Stage 1 designed (XWO clearing, still internal credits, migrations
   0019+) → Stage 2 stablecoin SANDBOX evaluation strictly behind the legal
   gate and only over cleared balances → Stage 3 token evaluation behind
   ALL EIGHT conjunctive TOKEN_GATES. DEX/liquidity/staking/yield/public
   token surfaces are permanently excluded at every stage.

## Cross-references updated

- `crypto/TOKEN_GATES.md` gate #3 now points at the design doc (status
  remains NOT PASSED — drafting a design passes nothing).
- Queue E-5 marked done; NEXT_PROMPTS prompt consumed; implementation
  tickets (0019+ clearing bootstrap, projection publisher, XWO services
  composing the existing escrow code, platform arbiter, reconciliation,
  exposure caps) listed as future founder-gated work.

## Verification

Docs-only change; `pnpm check` green (full suite unchanged + format/guards
over the new docs — doctrine guards deliberately allow internal docs under
`docs/cognitia/` to name gated concepts in order to gate them).
