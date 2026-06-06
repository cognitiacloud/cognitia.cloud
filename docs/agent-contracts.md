# Agent contracts

> Contracts are versioned. Changing a contract requires updating this doc, the
> Zod schemas in `packages/core`, the tests, and dependent code — in that order.

## 1. Agent roster

| Agent  | Role                          | MVP scope           |
| ------ | ----------------------------- | ------------------- |
| Mira   | Outbound signal agent         | v1 — this contract. |
| Echo   | Inbound / voice qualification | Planned.            |
| Atlas  | RevOps intelligence           | Planned.            |
| Beacon | Paid acquisition              | Later.              |

## 2. Mira v1 contract

### 2.1 Objective

Given a tenant's ICP/playbooks and a pool of accounts, identify and prioritize
high-fit, well-timed outbound opportunities and **propose** grounded outreach —
never sending without human approval.

### 2.2 Inputs

- `tenant_id`
- `playbook_id` (ICP + strategy)
- optional `segment_id` / explicit account id refs
- run `objective` string + `input_refs` (entity references, not raw data)

### 2.3 Steps (end-to-end)

1. Load tenant ICP and playbooks.
2. Select candidate accounts (CRM/imported).
3. Score account fit and timing.
4. Pick contacts/personas.
5. Build account/contact `ContextPack`.
6. Generate a research summary **with evidence refs**.
7. Generate an email sequence draft.
8. Run guardrails: suppression, evidence, spamminess, brand voice, compliance.
9. Create `agent_actions` for proposed email drafts and CRM tasks.
10. Surface in the approval queue.
11. On approval, execute via email adapter or create a CRM task (per tenant mode).
12. Record outcomes and feedback.

### 2.4 Capabilities

**Mira v1 MAY:** draft emails · propose CRM tasks · score accounts · create
recommendations · classify replies.

**Mira v1 MUST NOT:** auto-send email without approval · call prospects ·
automate LinkedIn actions · launch ads · mutate CRM owner/stage without
approval.

These limits are enforced by the `ToolRegistry` `riskLevel` + `PolicyGate`, not
by prompt instruction alone.

## 3. Context pack format

`ContextPack` is the grounded input to generation. Built deterministically
(SQL) first, then augmented with vector retrieval.

```jsonc
{
  "tenant_id": "uuid",
  "trace_id": "string",
  "account": {
    "ref": "account:uuid",
    "facts": [
      /* structured fields */
    ],
  },
  "contacts": [{ "ref": "contact:uuid", "persona": "string", "facts": [] }],
  "playbook": {
    "ref": "playbook:uuid",
    "icp": {
      /* ... */
    },
  },
  "signals": [{ "ref": "signal:uuid", "type": "string", "occurred_at": "ts" }],
  "evidence": [
    {
      "id": "string", // stable evidence id
      "claim": "string", // the assertion it supports
      "source_ref": "document:uuid|signal:uuid|crm:field",
      "snippet_hash": "sha256", // hash, not raw text, when PII-sensitive
      "score": 0.0,
    },
  ],
  "retrieval": [{ "chunk_ref": "document_chunk:uuid", "score": 0.0 }],
}
```

**Evidence rule:** every personalization claim in generated output must point to
at least one `evidence[].id`. Generation without evidence coverage fails the
evidence guardrail.

## 4. Action proposal format

A side-effect tool returns a proposal; the `ActionLedger` persists it as an
`agent_action`.

```jsonc
{
  "agent_action_id": "uuid", // assigned by ledger
  "tenant_id": "uuid",
  "agent_run_id": "uuid",
  "action_type": "email.draft.send | crm.task.create | crm.note.create",
  "risk_level": "low | medium | high",
  "idempotency_key": "string", // deterministic; replays are no-ops
  "approval_status": "proposed | approved | rejected",
  "execution_status": "pending | executing | executed | failed",
  "target_ref": "contact:uuid | account:uuid",
  "evidence_refs": ["string"], // must be non-empty for personalized sends
  "payload_ref": "string", // pointer to draft content (not inlined PII)
  "guardrail_results": [{ "name": "string", "passed": true, "detail": "..." }],
}
```

## 5. Approval policy

- **Default = human approval** for: outbound send, calling, CRM mutation, ads
  launch.
- `PolicyGate` sets `requires_approval` from: action `risk_level`, tenant
  settings (e.g. `auto_approve_low_risk`), and suppression/consent checks.
- An action may **never** execute while `approval_status != approved`. The email
  adapter refuses to send without an approved, ledgered action (tested).
- Suppressed/opted-out targets short-circuit: the action is blocked at proposal
  time and recorded with a suppression guardrail failure.

## 6. Tool registry shape

Every tool is typed and declared. Side-effect tools cannot execute directly —
they propose.

```ts
interface ToolDefinition<I, O> {
  name: string; // unique, namespaced e.g. "crm.task.create"
  description: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  sideEffect: boolean; // true => must route through ActionLedger
}
```

- `sideEffect: false` (read/score/draft) → may run inline within a run.
- `sideEffect: true` (send/create/mutate) → `execute()` is **not** callable;
  the runtime only allows `propose()`, which creates a ledger action.
- Risk classification feeds `PolicyGate`.

## 7. Runtime components

| Component          | Responsibility                                                                  |
| ------------------ | ------------------------------------------------------------------------------- |
| `AgentRunService`  | Create run, store objective/input refs, record status transitions, emit events. |
| `ContextBuilder`   | Deterministic SQL context, then vector retrieval → `ContextPack`.               |
| `ToolRegistry`     | Hold typed tools; gate side-effect tools to propose-only.                       |
| `PolicyGate`       | Classify risk, check tenant settings + suppression/consent, decide approval.    |
| `ActionLedger`     | Create/approve/reject/execute actions; enforce idempotency; record results.     |
| `FeedbackRecorder` | Record edits/approvals/rejections/outcomes; emit learning events.               |

## 8. Reply classification (Mira v1)

Mira classifies inbound replies into at least: `interested`, `not_interested`,
`unsubscribe`, `wrong_person`, `out_of_office`, `referral`, `other`.
`unsubscribe` and `wrong_person` must be handled explicitly:

- `unsubscribe` → add to suppression, emit feedback event, halt sequence.
- `wrong_person` → demote contact, request re-targeting, halt to that contact.
