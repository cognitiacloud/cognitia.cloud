# Claude Prompts for the Next Loop

Drop-in prompts to resume each worker. All inherit `../GUARDRAILS.md`.
Each worker writes ONLY to its own directory and classifies every output
VERIFIED / INFERRED / RECOMMENDED / UNSAFE.

---

## Next-6h focus prompt (Manager)

> Resume the Cognitia loop at Hour 6. Read `cognitia/loop/checkpoints/checkpoint-00-hour0.md`
> and `cognitia/loop/ROADMAP.md`. The convergent build is the proof-emitting
> harness step (B×D×E). Dispatch workers per the prompts below, collect
> outputs, write `checkpoint-01-hour6.md`, update ROADMAP + ARTIFACT_INDEX,
> commit, push, keep the draft PR current. Obey all hard-stops.

## Worker B×D×E — Proof-emitting harness step (primary build)

> Extend `cognitia/workers/E-harness-builder/harness_mvp.py` with a new MOCK
> executor `emit_proof` that, for one mock workflow in Worker B's
> `mock-workflows.md`, writes a hash-chained `ActionLedgerEntry` and a
> `ProofRecord` (with `does_not_attest`) using the schema in Worker D's
> `ledger-schema.md`. Add tests for Worker D's invariants T1 (conservation:
> Σdebits==Σcredits), T2 (no negative balance), and replay/idempotency. Pure
> stdlib, no network, deterministic. Run the tests and paste the output.
> Reconcile any schema mismatch between B and D into one shared definition.

## Worker A — Positioning one-pager + demo storyboard

> From `positioning-brief.md` and `competitor-map.md`, write
> `positioning-onepager.md` (internal narrative for "neutral proof/trust layer
> above agents") and `sidebyside-demo-storyboard.md` (Cognitia ledger vs.
> vendor-reported numbers, SYNTHETIC fixtures only, no real logos/PII).
> Research ERC-8004 as proof-registry substrate, read-only — no deploy, no
> mainnet tx. Cite sources; tag VERIFIED/INFERRED.

## Worker C — Claims register + sandbox adapter interface

> Write `claims-register.md` (claim → substantiation → reviewer, feeding the
> action ledger) and `sandbox-adapter-interface.md` (the ad-platform adapter
> INTERFACE with zero network calls — mock only, marked SANDBOX/MOCK).
> Keep all platform write/launch/spend UNSAFE and design-only.

## Worker D — Invariant test designs → hand to E

> Convert `sandbox-test-plan.md` T1/T2/T3 into concrete, language-agnostic test
> cases (inputs → expected) ready for Worker E to implement. No persistence, no
> real money. Keep redeem/withdraw/fiat parked as UNSAFE.

## Worker B — Claims-filter pure-function spec

> From `sales-closer-prompts.md`, specify the claims-filter as a pure function:
> input agent turn → {allow|deny, matched_rule, action.denied log}. Provide a
> test table with synthetic turns incl. ones that MUST be denied. No live sends.
