# Memo 3 — Action Ledger Spec (+ Reputation, Agent Passport)

**Status:** sandbox design · internal only
**Boundaries:** no public token, no chain, no legal conclusions. The action ledger
is an internal audit log, not a public or immutable-on-chain record.

## 1. Purpose

Define the **action ledger** — the append-only, versioned record of *everything an
agent or tenant does* in the economy — plus the two structures that read from it:
**reputation** and the **agent passport**. Presented as a contract over the
existing `audit_events`, `reputation_events`, and `agent_trust_credentials`
vocabulary (sibling-branch; *not verified in this branch HEAD*).

## 2. Action ledger

### Shape (contract over `audit_events`)

| Field | Type | Notes |
|-------|------|-------|
| `seq` | int (PK) | Monotonic, gap-free append order |
| `event_type` | string | **Versioned**, e.g. `economy.work_order.verified.v1` |
| `actor_ref` | string | Who acted (`agent:…`, `tenant:…`, `verifier:…`, `system`) |
| `subject_ref` | string | What it acted on (order/proof ref) |
| `idempotency_key` | string | De-dupes retries; same key ⇒ same entry, applied once |
| `payload` | dict | Small, internal-ref-only detail |

### Invariants

1. **Append-only.** No edits or deletes; the sandbox exposes only `record()` and
   `all()`.
2. **Versioned event types.** Every `event_type` ends in `.vN` so consumers can
   evolve safely. The test suite asserts this for every emitted type.
3. **Idempotent.** A repeated `idempotency_key` returns the original entry and
   applies the effect once (mirrors `credits_ledger` idempotency, migration 0012).

### Event-type catalog (v1)

| Event type | Meaning |
|------------|---------|
| `economy.agent.registered.v1` | Agent passport admitted |
| `economy.work_order.proposed.v1` | Tenant proposed work |
| `economy.work_order.accepted.v1` | Agent accepted; escrow funded |
| `economy.work_order.delivered.v1` | Agent delivered (claim proof recorded) |
| `economy.work_order.verified.v1` | Verifier confirmed; escrow released |
| `economy.work_order.rejected.v1` | Verification failed; escrow refunded |

## 3. Reputation (delta only on `verified_fact`)

Reputation is a derived, append-only tally — **never** a free-floating score.

| Rule | Enforcement |
|------|-------------|
| A **positive** delta requires a backing `verified_fact` proof | `Reputation.apply()` returns `False` and applies nothing otherwise |
| A **negative** delta (penalty) does *not* require `verified_fact` | penalties can be issued on `unknown`/`likely_inference` evidence |
| Every delta cites its `proof_id` and a reason | append-only `reputation_events` shape |

This is the core economic invariant: **standing is earned only against verified
work.** Aligns to migration 0010's "positive delta only on `verified_fact`",
enforced in DB trigger + in-memory mirror + service — here mirrored in code.

## 4. Agent passport (ATC-style internal identity)

A minimal internal identity record — the basis for "who is this agent" — modeled
on `agent_trust_credentials` (W3C-VC-*like* shape, **internal refs only, no crypto
suites, no PII**).

| Field | Example |
|-------|---------|
| `agent_ref` | `agent:lead-rescue` |
| `display_name` | `Auto Growth OS Lead-Rescue Agent` |
| `capabilities` | `("lead_followup", "appointment_booking")` |
| `atc_ref` | `atc:internal:lead-rescue:v1` |

The passport is **not** a wallet, key, or token holder. It is an internal
capability/identity descriptor used to scope what work an agent may accept.

## 5. How the three relate

```
action  --append-->  action ledger (audit_events)
   |                      ^
   |                      |  references proof_id
   +--> proof event ------+
            |
            v (only if verified_fact)
        reputation delta (reputation_events)

agent passport  --gates-->  which actions an agent may take
```

## 6. Sandbox mapping

| Concept | Sandbox object | Test |
|---------|----------------|------|
| Action ledger | `ActionLedger.record()/.all()` | `test_action_ledger_is_append_only_and_versioned` |
| Idempotency | `idempotency_key` dedupe | `test_idempotency_key_dedupes` |
| Reputation gate | `Reputation.apply()` | `ReputationTests` |
| Passport | `AgentPassport` | `WorkOrderLoopTests` setup |

## 7. Verification

```bash
python -m unittest sandbox.agent_economy.test_economy_sandbox.ReputationTests -v
python -m unittest sandbox.agent_economy.test_economy_sandbox.WorkOrderLoopTests -v
```
