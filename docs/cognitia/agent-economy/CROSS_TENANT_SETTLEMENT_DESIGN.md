# Cross-Tenant Settlement Design (AGENT-ECONOMY-005) — INTERNAL

Date: 2026-06-12. Classification: INTERNAL design document. **Nothing in this
document is implemented.** Statements about the EXISTING lab (0016–0018,
services, guards) are `verified_fact`; everything proposed is design —
`likely_inference` by definition, to be hardened ticket by ticket behind its
own migrations. This document is the technical half of the **multi-tenant
gate** in `docs/cognitia/crypto/TOKEN_GATES.md` (#3); writing it passes
nothing.

## 1. The problem

Today the Agent Economy Lab is complete but SINGLE-tenant: work orders,
escrow, listings, reputation, disputes, and the Action Ledger are all
tenant-scoped by RLS (live-verified under a non-superuser role). The economy
thesis, however, is platform-wide (Architecture Lock A1: any future token
attaches to the cross-tenant economy layer, never one tenant). The question
this document answers: **how does tenant A's requester agent safely hire
tenant B's worker agent**, settle in internal credits, and leave behind the
same evidence discipline the single-tenant lab enforces — without ever
weakening tenant isolation.

## 2. Tenant boundaries — what NEVER crosses (non-negotiable)

| Never crosses a tenant boundary                              | Why / enforcement today                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Raw or encrypted PII (`lead_intakes.*_enc`, decrypted views) | PII rule; RLS; operator-gated decryption                                                                     |
| `proofs.details_private`                                     | only `public_safe` projections after a passed redaction check (0009)                                         |
| Drafts / payload bodies                                      | stored out-of-band per PII rule                                                                              |
| Reputation EVENTS                                            | events are tenant evidence; only derived attestations cross (§5)                                             |
| Credits LEDGER ROWS                                          | ledgers stay per-tenant; settlement is mirrored, not shared (§4)                                             |
| Database connections                                         | RLS is authoritative; NO shared-DB integration, ever (the moveros-staging lesson: HTTP-style contracts only) |
| Approval authority                                           | each tenant's humans approve their own side; no tenant approves inside another                               |

RLS remains the wall. The only trusted path stays the documented service-role
path (0001 tenants management) — cross-tenant settlement adds NO new RLS
bypasses; it adds a **platform clearing tenant** that is itself just another
RLS-scoped tenant.

## 3. The actors

- **Requester tenant** (A): wants work; funds it.
- **Worker tenant** (B): supplies the agent + SkillProof version.
- **Platform clearing tenant** (P): a dedicated, service-operated tenant that
  hosts the clearing ledger, the cross-tenant registry projections, and the
  escalation arbiter. P is governed like any tenant (RLS, audit, owner role =
  platform operations) — it is a _participant with special duties_, not a
  backdoor.

## 4. Cross-tenant escrow + settlement (the two-ledger clearing model)

Per-tenant credit ledgers stay authoritative and untouched in shape. A
cross-tenant work order (XWO) settles through **three conserved, mirrored
movements**, every leg remaining a balanced, idempotent, audited pair on the
existing 0012 machinery:

```
RESERVE (on accept)
  A-ledger:  requester agent → A's escrow account            wo discipline, unchanged
  P-ledger:  A's clearing account → XWO clearing escrow      mirror entry, key xwo:<id>:reserve

RELEASE (on verify — verified_fact proof required, BOTH ledgers refuse otherwise)
  P-ledger:  XWO clearing escrow → B's clearing account      key xwo:<id>:release
  B-ledger:  B's settlement source → worker agent account    grant-shaped, key xwo:<id>:settle

REFUND / SPLIT (reject / arbitration)
  exact mirrors of the 0017 semantics with xwo:<id>:refund / :resolve:* keys
```

Design invariants (each becomes a trigger + mirror + service rule when
implemented, like every lab invariant):

1. **Conservation per XWO**: Σ(A reserve) = Σ(P clearing movements) =
   Σ(B settlements + A refunds). A reconciliation job proves this from the
   ledgers alone — balances stay derived, never stored.
2. **verified_fact-only release**, now enforced on P as well: the clearing
   escrow cannot release without the delivery proof's PUBLIC-SAFE projection
   carrying `evidence_tag=verified_fact` (the proof row itself never leaves
   B; its redacted projection + id + tag do).
3. **No new value class.** Stage 1 runs entirely on `internal_credits`.
   Inter-ledger clearing legs would use a new rail value
   (`platform_clearing`) added by a deliberate 0012-style check-widening
   migration — reserved, not written.
4. **Idempotency namespace `xwo:`** keeps cross-tenant keys disjoint from
   every single-tenant key by construction.
5. Tenant exposure limits: P caps each tenant's clearing balance (no
   unbounded inter-tenant credit creation); `system` overdraft stays
   single-tenant only.

## 5. Reputation portability (attestations, never transfers)

Reputation stays **non-transferable and tenant-scoped as raw events** —
that rule does not bend. What crosses is a derived **reputation
attestation**: a `public_safe` proof-shaped projection published by B into
P's registry containing only: agent ref, score, event count, verified work
order count, top SkillProof tier, snapshot `inputs_hash` (already
reproducible per COG-008), and issuance time — redaction-checked like every
public proof. Marketplace matching across tenants ranks on attestations
exactly as 0018 ranks today (tier × 1000 + reputation × 10 + verified
orders), so the cross-tenant ranking inherits the same honesty: every input
is verified_fact-gated at its source. Attestations are read-only evidence:
they are never imported as events, never summed across tenants into a
"global score", and never tokenized (hard exclusion in TOKEN_UTILITY_MAP).
Skill tiers port the same way — attestation referencing the verified_fact
skill proofs, never a copied row.

ATC verification across tenants: B's agent presents its ATC id; P verifies
status against B's registry via the same internal service surface (issuer
`cognitia.internal` today; the Lock's standards posture — ERC-8004 / VC /
EAS compatibility — is exactly what makes this externally verifiable later
WITHOUT a custom method).

## 6. Cross-tenant work-order protocol (XWO lifecycle)

Same state machine as 0016/0017 — `proposed → accepted → in_progress →
delivered → verified | rejected | disputed → resolved` — with both-side
consent gates:

1. B publishes a listing PROJECTION to P (redacted: skill name/version/tier
   attestation/price; never internals). Yanked versions and inactive ATCs are
   suppressed at the source, as 0018 already does.
2. A's requester orders against the projection → XWO in P + a local work
   order in A (escrow reserved per §4).
3. B's worker accepts through B's OWN Action Ledger (003 discipline: ATC +
   permission + human approval in B). A never approves B's agents; B never
   approves A's spend.
4. Delivery: B runs the simulated execution; the proof stays in B; its
   public_safe projection (id, tag, summary, hashes) lands in P attached to
   the XWO. Proofless delivery refused, as today.
5. Verification: A's OWNER verifies (payout posture unchanged) → release per
   §4 → reputation event lands in B (B's agent earned it), attestation
   refreshes in P.
6. Disputes: held escrow freezes in P. Arbitration escalates to the
   PLATFORM arbiter (P's owner) using 0017 semantics — release/refund/split,
   conserved math, append-only resolution record, verified_fact resolution
   proof in P. Neither tenant unilaterally arbitrates a cross-tenant dispute.

## 7. Privacy rules for every cross-tenant surface

- Only `public_safe`, redaction-checked projections cross; the scanner
  (COG-003) gates publication exactly as it gates public proofs today.
- P stores REFERENCES + redacted summaries + hashes, never bodies.
- Aggregates published by P obey a floor (no per-customer or deanonymizable
  slices); tenant identities in P's registry are slugs, never customer data.
- Both sides audit every XWO transition in their own `audit_events`; P
  audits the clearing legs. Three audit trails, one conserved story.
- A tenant can withdraw from cross-tenant participation; its projections are
  unpublished (registry rows in P are deactivated, not deleted — append-only
  history with status, the wallet-binding pattern).

## 8. Where credits / stablecoins / token evaluation slots (the stage ladder)

| Stage                             | Settlement unit                                                                                          | Gate to enter                                                                                   | Status                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| 0 — today                         | internal credits, single-tenant                                                                          | —                                                                                               | **built** (0016–0018)          |
| 1 — XWO clearing                  | internal credits via P (this design)                                                                     | founder go + implementation tickets (migrations 0019+)                                          | designed only                  |
| 2 — stablecoin SANDBOX evaluation | sandbox stablecoin settling CLEARED P-balances only — never escrow, never customer-facing, no real funds | Stage 1 live with real volume + **legal gate** + counsel-approved sandbox scope                 | not designed; placeholder only |
| 3 — token utility evaluation      | per TOKEN_UTILITY_MAP candidates                                                                         | ALL EIGHT TOKEN_GATES conjunctive (this doc only drafts the multi-tenant gate's technical half) | locked                         |

Permanent exclusions at every stage: DEX, liquidity provisioning, staking,
yield, public token/coin surfaces, price/return language, token transfers,
real payments without their own gated rails. Wallet bindings stay inert
placeholders until and unless Stage 2+ is approved through the gates.

## 9. What implementation would actually require (future tickets, 0019+)

1. `0019` platform clearing tenant bootstrap + clearing-account owner type +
   `xwo` tables (state machine + conservation triggers + RLS) — twin repos +
   contract tests, as always.
2. Projection publisher: listing/attestation/proof projections with the
   redaction scanner in the write path.
3. XWO services composing the EXISTING accept/deliver/verify/resolve — no
   second escrow implementation; the 001/002 services stay the only code
   that moves credits.
4. Platform arbiter role + escalation routes (0017 semantics in P).
5. Reconciliation job + `/agent-economy/clearing` summary surface.
6. Exposure caps + participation registry.

Each is session-sized; none starts without founder direction.

## 10. Open questions (flagged, not decided)

- Clearing-balance true-up between tenants: pure bookkeeping forever, or
  periodically settled by an external instrument (a Stage 2 question)?
- Cross-tenant dispute SLA and what happens to frozen escrow on tenant
  withdrawal mid-dispute (proposal: platform arbiter resolves before
  deactivation completes).
- Whether attestations should expire / decay (reputation freshness) — ties
  to the deferred scoring-sophistication work from COG-008.
- Fee model for P (if any) — deliberately undesigned; any fee is just
  another conserved ledger leg, but pricing policy is a founder decision.
