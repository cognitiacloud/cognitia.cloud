# Audit-chain external anchoring (mechanism)

Addresses the SEC-1 / self-audit note that the audit chain is tamper-**evident**,
not tamper-**proof**: a DB superuser could rewrite a row _and_ recompute the
forward hashes, leaving an internally-consistent but falsified history. Code:
`apps/api/src/anchoring.ts`, routes under `/audit/anchor*`.

## How it works

- **Anchor** (`POST /audit/anchor`, owner-only, audited as `audit_chain_anchored`):
  compute the chain **tip hash** (the head event's hash) + event count + integrity,
  and publish it to an **independent, append-only sink** that the application DB
  role cannot rewrite.
- **Verify** (`GET /audit/anchor/verify`, read-only, viewer-allowed): recompute
  the live chain and compare to the latest anchor. Because append-only growth
  preserves every prior hash, the anchored tip hash **must still be present** in
  the live chain. If it is gone (`anchored_tip_absent`) — or the chain itself no
  longer verifies (`current_chain_broken`) or shrank (`history_shrank`) — history
  was rewritten/truncated, **detectable even against a privileged tamperer** who
  controls the DB but not the external sink.

## Honest scope — this is a MECHANISM, not provisioned custody

The default `AnchorSink` is **in-memory**: it exercises the anchor/verify logic
and tests, but it is **not durable and not independent of the process**, so by
itself it provides **no real tamper-proofing**. Real protection requires an
external, append-only sink the DB role cannot touch — e.g. WORM/object-lock
storage, a timestamp/notary service, or an external audit log — injected via
`ApiHandlersConfig.anchorSink`. **That custody is infrastructure and is NOT
claimed here.** The strength of the control equals the independence + durability
of the operator-provided sink.

## Guardrails preserved

Anchoring is owner-only and itself audited; verification is read-only;
tenant-scoped throughout; no migration. The anchor records refs/hashes only —
never raw PII. Tests: `anchoring.test.ts` (tip computation, append-only-growth
consistency, rewrite/absent-tip detection, no-anchor, owner-gating + audit).
