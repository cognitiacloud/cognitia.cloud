# Client Zero Compliance Gate

Status: demo / pre-implementation. Pure, deterministic, side-effect-free.
Code: [`apps/web/src/lib/clientZeroComplianceGate.ts`](../../apps/web/src/lib/clientZeroComplianceGate.ts)
· Tests: [`clientZeroComplianceGate.test.ts`](../../apps/web/src/lib/clientZeroComplianceGate.test.ts)

## Why this exists

The "Client Zero: Auto Growth OS" package (PR #106) is a strong documentation +
discovery deliverable, but its review
([`docs/reviews/pr-106-client-zero-review.md`](../reviews/pr-106-client-zero-review.md))
found the gating problem: its human-approval gates, its **finance / trade-in
HARD-STOP**, and its "proof registry" are **prose doctrine, not code-enforced
controls**. PR #106 ships no `apps/` / `packages/` code and does not wire into
the merged compliance spine.

This gate is the **code-enforced counterpart** to that doctrine. It adapts the
mock Client Zero workflow's actions onto the merged, PII-safe compliance engine
([`apps/web/src/lib/compliance.ts`](../../apps/web/src/lib/compliance.ts)), adding
Client-Zero-specific surface rules, stable reason codes, an explicit human
approval gate model, and an audit/proof-friendly decision shape.

It does **not** weaken any existing rule: suppression stays supreme, gated
channels stay off, and outreach is never auto-sent. See the canonical
[compliance system spec](./compliance-system-spec.md) (Gates A/B/C,
`consent_basis`, suppression supremacy, evidence requirements).

## Hard rules (enforced or honoured)

- No live outreach; no SMS / calls / WhatsApp / AI voice (gated off by default).
- No real prospect data — fixtures are fictional B2B dealerships.
- No raw PII: prospects carry hashes / masks / domain only; decisions carry a
  prospect id + reason codes only. A test asserts no raw email / phone is ever
  emitted in decisions, audit logs, proof events, or fixtures.
- No legal conclusions — the gate emits reason codes and routes to a human; it
  never adjudicates lawfulness.
- Human approval is required before **any** draft / send / booking action.

## Expected mock-workflow interface (the adapter seam)

A Client Zero workflow runner is expected to present each side-effecting step as
a `ClientZeroWorkflowAction` and call `evaluateClientZeroGate(action)` before
executing it. The Client Zero workflow itself is not yet built; this is the
interface it must implement.

```ts
type ClientZeroSurface =
  | 'discovery'
  | 'proposal'
  | 'pricing'
  | 'finance'
  | 'trade_in'
  | 'inventory'
  | 'general_outreach';
type ClientZeroActionKind = 'draft' | 'send' | 'booking';

interface HumanApprovalState {
  required: boolean;
  status: 'proposed' | 'approved' | 'rejected'; // @cognitia/core ApprovalStatus
  approverType?: 'human' | 'agent';
  approverId?: string;
  approvedAt?: string;
}

interface ClientZeroWorkflowAction {
  surface: ClientZeroSurface;
  actionKind: ClientZeroActionKind;
  channel: Channel; // complianceTypes.ts
  prospect: GtmProspect; // @cognitia/core — PII-safe (hashes/masks/domain)
  evidence?: EvidenceField[];
  approval?: HumanApprovalState;
}
```

## Reason codes

| Code                           | Meaning                                        | Severity                          |
| ------------------------------ | ---------------------------------------------- | --------------------------------- |
| `CZ_DO_NOT_CONTACT`            | On the do-not-contact list                     | blocked                           |
| `CZ_UNSUBSCRIBED`              | Contact unsubscribed                           | blocked                           |
| `CZ_CHANNEL_GATED_OFF`         | Channel gated off (sms / whatsapp / ai_voice)  | blocked                           |
| `CZ_SOURCE_BLOCKED`            | Data source blocked for prospecting            | blocked                           |
| `CZ_APPROVAL_NOT_GRANTED`      | Approval requested but rejected                | blocked                           |
| `CZ_CONSENT_MISSING`           | No established consent / contact basis         | blocked (send) / approval (draft) |
| `CZ_FINANCE_HANDOFF_REQUIRED`  | Finance — regulated, collect-and-handoff only  | handoff_required                  |
| `CZ_TRADE_IN_HANDOFF_REQUIRED` | Trade-in — regulated, collect-and-handoff only | handoff_required                  |
| `CZ_PRICING_APPROVAL_REQUIRED` | Pricing is never a firm quote without sign-off | approval_required                 |
| `CZ_SOURCE_HIGH_RISK`          | High-risk data source                          | approval_required                 |
| `CZ_EVIDENCE_INCOMPLETE`       | Required provenance evidence incomplete        | approval_required                 |
| `CZ_HUMAN_APPROVAL_REQUIRED`   | The standing pre-send human approval gate      | approval_required                 |

## Gate model & outcome precedence

`evaluateClientZeroGate` accumulates every applicable reason code, then derives a
single outcome from the **worst** code:

```
blocked  >  handoff_required  >  approval_required  >  proceed
```

- **Suppression is supreme.** Do-not-contact / unsubscribe block regardless of
  surface, channel, evidence, or approval.
- **Regulated surfaces always route to a human.** `finance` and `trade_in`
  resolve to `handoff_required`; a generic approval never clears them.
- **Approval is always required.** Every action carries `CZ_HUMAN_APPROVAL_REQUIRED`
  unless a `human`-typed, `approved` `HumanApprovalState` is present. An agent can
  never self-approve (`isHumanApprovalGranted` requires `approverType === 'human'`).
- **`proceed`** is reached only when no reason code remains — i.e. a clean,
  consented, evidenced prospect on a non-regulated surface with a granted human
  approval.

### Decision shape (audit/proof-friendly)

```ts
interface ClientZeroGateDecision {
  outcome: 'blocked' | 'handoff_required' | 'approval_required' | 'proceed';
  surface;
  actionKind;
  channel;
  reasonCodes: ClientZeroReasonCode[];
  reasons: string[]; // human-readable, no PII
  requiresHumanApproval: boolean;
  prospectId?: string; // never raw email / phone
  policyVersion: string; // CLIENT_ZERO_GATE_POLICY_VERSION
  decidedAt: string;
}
```

Helpers `clientZeroDecisionToLog` and `clientZeroDecisionToProof` reuse the engine
builders (`createComplianceLogEntry` / `createComplianceProofEvent`) to emit an
append-only audit log entry and a proof-ledger event from a decision — carrying
prospect id + reason codes only.

## Verification

```bash
pnpm install
pnpm vitest run apps/web/src/lib/clientZeroComplianceGate.test.ts   # all green
pnpm run typecheck
pnpm run format:check
```

The test suite covers: consent missing → blocked; finance / trade-in → handoff
required; approved consent → proceed; suppression + gated-channel blocks; and the
no-raw-PII invariant across decisions, logs, proofs, and fixtures.
