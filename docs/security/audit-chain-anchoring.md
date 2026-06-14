# Audit-chain external anchoring (mechanism)

Addresses the SEC-1 / self-audit note that the audit chain is tamper-**evident**,
not tamper-**proof**: a DB superuser could rewrite a row _and_ recompute the
forward hashes, leaving an internally-consistent but falsified history. Code:
`apps/api/src/anchoring.ts`, routes under `/audit/anchor*`.

## How it works

- **Anchor** (`POST /audit/anchor`, owner-only, audited as `audit_chain_anchored`):
  compute the chain **tip hash** (the head event's hash) + event count + integrity,
  and publish it to an **append-only sink** (independent of the DB role in
  production — see "Sinks" below for the durability-vs-independence distinction).
- **Verify** (`GET /audit/anchor/verify`, read-only, viewer-allowed): recompute
  the live chain and compare to the latest anchor. Because append-only growth
  preserves every prior hash, the anchored tip hash **must still be present** in
  the live chain. If it is gone (`anchored_tip_absent`) — or the chain itself no
  longer verifies (`current_chain_broken`) or shrank (`history_shrank`) — history
  was rewritten/truncated, **detectable even against a privileged tamperer** who
  controls the DB but not the external sink.

## Sinks — durability vs independence (two different properties)

The seam ships two reference sinks behind `AnchorSink`, both honest about scope:

- **`InMemoryAnchorSink`** — mechanism + tests only. Not durable, not
  independent: provides **no real tamper-proofing**.
- **`FileAnchorSink`** — append-only JSON Lines on the **local host**. This is
  **durable** (anchors survive a process restart, so cross-run tampering is
  detectable) but **NOT independent**: the file is on the same host and writable
  by the app's role, so a host/DB-privileged tamperer who rewrites the audit
  rows can usually also rewrite or delete the anchor file and defeat detection.
  It raises the bar against an attacker **without** host/file access; it is not
  tamper-proofing. (Asserted directly by the "HONEST LIMITATION" test.)

## Honest scope — DURABLE ≠ INDEPENDENT; custody is still infra

Real tamper-proofing — an attacker who breaks the DB still cannot touch the
anchor — requires an **external, independent, append-only custodian** the app
role cannot reach: WORM/object-lock storage, a timestamp/notary service, or an
off-host audit log, injected via `ApiHandlersConfig.anchorSink`. **That custody
is infrastructure and is NOT claimed here.** The strength of the control equals
the independence + durability of the operator-provided sink.

## Fail-closed publish

`anchorAuditChain` is **fail-closed**: if the sink cannot durably persist, it
throws `AnchorPublishError` and returns no record, and the handler records **no**
`audit_chain_anchored` event. A failed anchor therefore never leaves false
evidence that the chain is tamper-proofed.

## Guardrails preserved

Anchoring is owner-only and itself audited; verification is read-only;
tenant-scoped throughout; no migration. The anchor records refs/hashes only —
never raw PII. Tests: `anchoring.test.ts` (tip computation, append-only-growth
consistency, rewrite/absent-tip detection, no-anchor, owner-gating + audit) and
`anchoring.hardening.test.ts` (FileAnchorSink durability + tenant scoping,
fail-closed publish at the unit and handler level, replay/truncation signals,
and the co-located-anchor limitation).
