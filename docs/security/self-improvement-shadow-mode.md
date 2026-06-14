# Shadow-mode self-improvement scaffolding (Item 4)

A sandboxed, **inert** proposal ledger for internal improvement ideas
(prompt/rule/workflow/threshold). Code: `apps/api/src/selfImprove.ts`.

## What it is

- A governed state machine for _proposals_: `proposed → evaluated → approved |
rejected`; `approved → rolled_back`. Illegal transitions throw.
- Every transition records who/when. Evaluation attaches evidence before any
  decision.

## What it is NOT (safety by construction)

- **It applies nothing.** There is no executor in this module; an approved
  proposal is a _record_, not an applied change.
- **Nothing is auto-promoted** — `auto_applied` is the literal `false` on every
  record (asserted in tests).
- Promotion to `approved` is a deliberate human decision; the API layer that
  exposes this (future) must gate approval owner-only and audit it, exactly like
  every other privileged op.

This means a future self-improvement loop is human-gated and evidence-backed by
construction, and this scaffolding **cannot weaken any security control** because
it changes nothing.

## Residual (NOT done — needs product decisions)

- Persistence beyond the in-memory `InMemoryProposalStore` seam.
- An owner-gated API surface (propose/evaluate/approve/reject/rollback) — would
  join the authz manifest with negative tests.
- An _applier_ that turns an approved proposal into a real change — deliberately
  NOT built; it requires product decisions (what may be changed, by whom) and
  must remain human-approved + reversible + audited. Out of scope until decided.
