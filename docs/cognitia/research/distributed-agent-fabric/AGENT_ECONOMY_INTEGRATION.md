# Agent Economy Integration (design-only)

How the fabric binds to Cognitia's existing, tested primitives. The fabric adds
_distribution_; the economy already exists.

| Fabric concept          | Cognitia primitive (existing)    | Notes                                                                                |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| Node / agent identity   | **ATC** (0009)                   | issuer/subject/claims/status; revocation terminal; node attestation binds device↔ATC |
| What a node can do      | **SkillProof** (0010/0013)       | tier ≥ 2 requires `verified_fact`; no self-asserted high tiers                       |
| Execution receipt       | **Proof Registry** (0009)        | append-only, evidence-tagged; public projection redaction-gated                      |
| Node/worker performance | **Reputation** (0010)            | only `verified_fact` moves it; aggregate-only in public surfaces                     |
| Task assignment         | **Work Orders** (0016)           | proposed→…→verified/disputed→resolved; terminal states enforced                      |
| Settlement              | **Credits + Escrow** (0012/0016) | internal credits only; release on `verified_fact`; no real payment                   |
| Capability discovery    | **Marketplace** (0018)           | internal-visibility check-locked; no public market                                   |
| Failure / unsafe work   | **Disputes** (0017)              | owner arbitration; resolution proof; reputation slash                                |
| Agent-initiated actions | **Action Ledger**                | ATC + permission gated, approval-required; verify/resolve stay human                 |
| Future value-at-risk    | **Token (gated)**                | assurance collateral ONLY if all gates pass; may never exist                         |

## Key invariants the fabric must NOT break

- Only `verified_fact` proofs move reputation or release escrow.
- Agents never get uncontrolled execution; high-risk actions are approval-required.
- Verify and dispute-arbitration are human owner decisions, never agent-proposable.
- Internal credits are non-transferable outside the tenant ledger; no real payments.
- Public surfaces expose aggregate reputation + redaction-passed proofs only.

## What changes vs. today

- Work can be **executed on a remote node** instead of in-process; the receipt +
  evidence flow is the same, plus a **node attestation**.
- Routing adds capability/policy/locality inputs to assignment.
- Cross-node/cross-tenant settlement reuses the existing **cross-tenant settlement
  design** (doc-first, gated) — no new money rail.

## Out of scope (now)

No code, no new migrations. This maps the design onto primitives that already exist
and are tested on two backends.
