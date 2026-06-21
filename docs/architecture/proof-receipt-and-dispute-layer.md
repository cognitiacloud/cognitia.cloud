# Proof Receipt & Dispute Layer

**Status:** Design / Architecture
**Owner:** Proof & Forensics
**Audience:** Engineering, Trust & Safety, Customer reviewers, Auditors
**Last updated:** 2026-06-21

---

## 0. Why this exists (and why it beats Alta)

Cognitia runs autonomous agents that read context, make decisions, and take
real actions in customer systems (CRMs, inboxes, calendars, content
pipelines). The hard question every buyer eventually asks is:

> "Your agent touched my pipeline. **Prove what it did, and prove it was
> allowed to.**"

Most agent vendors — Alta included — answer this with a log stream: a flat
list of "the agent sent an email" events. A log tells you *that something
happened*. It does **not** tell you:

- what the agent **believed** when it acted, and whether that belief was a
  **verified fact** or a **guess**,
- **who or what authorized** the action,
- **which policies** were evaluated and which **passed/failed**,
- what the agent **was blocked from doing**,
- and whether any of it can be **independently re-checked** later.

The **Proof Receipt & Dispute Layer** is Cognitia's answer. Every
consequential agent action emits a **Proof Receipt**: a structured,
tamper-evident, replayable record that binds together *the action*, *the
evidence behind it*, *the approval that permitted it*, and *the policy
checks that gated it*. When something looks wrong, a **Dispute** can be
opened against a receipt, investigated by **replay**, and resolved with a
documented outcome.

This is the difference between "trust us, here's a log" and "here's the
receipt — verify it yourself."

### Design principles

| Principle | What it means here |
|---|---|
| **Provable, not narrated** | Every claim an agent acts on is tagged `verified_fact`, `likely_inference`, or `unknown`, with a pointer to its source. |
| **Authorization is first-class** | No consequential action without an attached approval record and a passing policy check. |
| **Blocks are evidence too** | What the agent was *prevented* from doing is recorded with the same rigor as what it did. |
| **Re-checkable** | Any receipt can be replayed deterministically against its captured inputs to confirm the decision. |
| **Tamper-evident, not trust-me** | Receipts are hash-linked in an append-only ledger so silent edits are detectable. |
| **Privacy by construction** | No raw PII in receipts — only pseudonymous references, redacted previews, and salted hashes. |

### Hard constraints honored by this design

- **No live customer data** — all examples use the synthetic **Client Zero**
  tenant.
- **No raw PII** — personal data is referenced by pseudonymous `subject_ref`
  IDs and `*_hash` digests; human-readable fields are redacted previews only.
- **No chain / no token** — integrity uses an internal **hash-linked
  append-only ledger** (a hash chain over receipts). This is *not* a
  blockchain and requires *no* cryptocurrency, token, gas, or external
  distributed ledger. It is plain SHA-256 over ordered records in Cognitia's
  own database.
- **No product code** — this document defines schemas and process only. JSON
  blocks below are *illustrative schema/instance examples*, not shippable
  code.

---

## 1. The objects, at a glance

A Proof Receipt is a small graph of linked records. One receipt per
consequential agent action.

```
                         ┌─────────────────────┐
                         │    PROOF RECEIPT     │  one per action
                         │  (action + verdict)  │
                         └──────────┬──────────-┘
            ┌───────────────┬───────┼────────┬───────────────┐
            ▼               ▼       ▼         ▼               ▼
     ┌────────────┐  ┌───────────┐ ┌─────────────┐  ┌────────────────┐
     │  EVIDENCE  │  │ APPROVAL  │ │ POLICY CHECK │  │ CRM/WRITEBACK  │
     │   ITEMS    │  │  RECORD   │ │   RECORD(S)  │  │     RECORD     │
     │ (tagged)   │  └─────┬─────┘ └──────────────┘  └────────────────┘
     └─────┬──────┘        │
           ▼               │   (if action denied instead of taken)
     ┌────────────┐        │            ▼
     │   SOURCE   │        │   ┌────────────────────┐
     │  RECORDS   │        │   │  BLOCKED-ACTION    │
     └────────────┘        │   │      RECORD        │
                           │   └────────────────────┘
                           ▼
                   (later, if contested)
                   ┌────────────────────┐
                   │      DISPUTE       │  opened → investigating → resolved
                   └────────────────────┘
```

Every record carries stable IDs so the graph can be reassembled and replayed.

### ID conventions

| Prefix | Object | Example |
|---|---|---|
| `rcpt_` | Proof receipt | `rcpt_01J9Z3Q...` |
| `ev_` | Evidence item | `ev_8f2c...` |
| `src_` | Source record | `src_crm_hubspot_01` |
| `appr_` | Approval record | `appr_7a1d...` |
| `pol_` | Policy check record | `pol_outreach_consent` |
| `wb_` | CRM/writeback record | `wb_44ce...` |
| `blk_` | Blocked-action record | `blk_19ab...` |
| `disp_` | Dispute | `disp_03fe...` |
| `subj_` | Pseudonymous subject ref | `subj_c0_000142` |
| `run_` | Agent run / decision trace | `run_2f90...` |

IDs are ULIDs/UUIDs unless noted; the prefix encodes type. `subj_` values are
**pseudonymous** — they map to real identities only inside the tenant's
isolated identity vault, never inside a receipt.

---

## 2. Proof Receipt schema

The receipt is the root object. It is immutable once `sealed`.

### 2.1 Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `receipt_id` | string (`rcpt_`) | yes | Globally unique receipt ID. |
| `schema_version` | string | yes | e.g. `"1.0"`. Receipts are versioned. |
| `tenant_id` | string | yes | Customer tenant. `client_zero` for synthetic. |
| `run_id` | string (`run_`) | yes | The agent run/decision trace that produced the action. |
| `agent` | object | yes | `{ agent_id, agent_name, agent_version, model_id }`. |
| `action` | object | yes | What was attempted (see 2.2). |
| `outcome` | enum | yes | `taken` \| `blocked` \| `simulated` \| `failed`. |
| `intent` | string | yes | One-line human summary of what the agent set out to do. |
| `evidence` | array<EvidenceItem> | yes | The tagged claims the decision relied on (see §3). |
| `evidence_summary` | object | yes | Counts per tag: `{ verified_fact, likely_inference, unknown }`. |
| `approval_ref` | string (`appr_`) | conditional | Required when `outcome = taken` for a consequential action. |
| `policy_checks` | array<string (`pol_`)> | yes | All policy check records evaluated (see §5). |
| `policy_verdict` | enum | yes | `allow` \| `deny` \| `allow_with_conditions`. |
| `writeback_ref` | string (`wb_`) | conditional | Present if the action wrote to an external system (§7). |
| `blocked_ref` | string (`blk_`) | conditional | Present when `outcome = blocked` (§8). |
| `subject_refs` | array<string (`subj_`)> | yes | Pseudonymous subjects affected. May be empty. |
| `created_at` | string (RFC3339, UTC) | yes | When the receipt was emitted. |
| `sealed_at` | string (RFC3339, UTC) | yes | When the receipt became immutable. |
| `disputed` | bool | yes | Whether any open dispute targets this receipt. |
| `dispute_refs` | array<string (`disp_`)> | no | Disputes targeting this receipt. |
| `integrity` | object | yes | Hash-chain integrity block (see 2.3). |
| `redaction` | object | yes | `{ pii_redacted: bool, redaction_policy_id, scrubbed_fields[] }`. |

### 2.2 `action` object

| Field | Type | Description |
|---|---|---|
| `action_id` | string | Unique per attempt. |
| `type` | enum | e.g. `email.send`, `crm.update`, `task.create`, `meeting.book`, `content.publish`. |
| `category` | enum | `consequential` \| `internal` \| `read_only`. Drives whether approval is required. |
| `target_system` | string | e.g. `hubspot`, `gmail`, `internal`. |
| `payload_preview` | object | **Redacted** preview of what was done (no raw PII). |
| `payload_hash` | string | SHA-256 of the canonicalized full payload (stored in the vault, not here). |
| `reversible` | bool | Whether the action can be automatically undone. |
| `undo_ref` | string | If reversible, how to reverse it (e.g. a writeback compensation handle). |

### 2.3 `integrity` block (tamper-evidence without a blockchain)

Receipts are appended to a per-tenant **append-only ledger**. Each receipt
hashes its own content plus the hash of the previous receipt, forming a hash
chain. Detecting tampering = recomputing the chain.

| Field | Type | Description |
|---|---|---|
| `content_hash` | string | SHA-256 over the canonical receipt body (all fields except `integrity`). |
| `prev_receipt_hash` | string | `content_hash` of the previous receipt in this tenant's ledger. |
| `chain_index` | int | Monotonic position in the tenant ledger. |
| `ledger_checkpoint_id` | string | The periodic checkpoint this receipt falls under (see §9.4). |
| `signature` | string | Optional HMAC/asymmetric signature by the Cognitia signing key. |

> **Not a blockchain.** This is an ordered hash chain inside Cognitia's own
> database. There is no token, no gas, no consensus network, no external
> ledger. It exists purely so that a silent edit to a past receipt is
> mathematically detectable during audit.

### 2.4 Example (structure only)

```json
{
  "receipt_id": "rcpt_01J9Z3Q8M4F0RABCDEF12345",
  "schema_version": "1.0",
  "tenant_id": "client_zero",
  "run_id": "run_2f90a1c7",
  "agent": {
    "agent_id": "agt_sdr_01",
    "agent_name": "Cognitia SDR",
    "agent_version": "2026.06.0",
    "model_id": "claude-opus-4-8"
  },
  "action": {
    "action_id": "act_88a2",
    "type": "email.send",
    "category": "consequential",
    "target_system": "gmail",
    "payload_preview": {
      "to": "subj_c0_000142",
      "subject": "Following up on your demo request",
      "body_preview": "Hi [REDACTED_FIRST_NAME], thanks for trying the…"
    },
    "payload_hash": "sha256:9f1b…",
    "reversible": false,
    "undo_ref": null
  },
  "outcome": "taken",
  "intent": "Send a first follow-up email to a lead who requested a demo.",
  "evidence": [ "…see §3 example…" ],
  "evidence_summary": { "verified_fact": 3, "likely_inference": 1, "unknown": 1 },
  "approval_ref": "appr_7a1d",
  "policy_checks": ["pol_outreach_consent", "pol_send_rate", "pol_content_safety"],
  "policy_verdict": "allow_with_conditions",
  "writeback_ref": "wb_44ce",
  "blocked_ref": null,
  "subject_refs": ["subj_c0_000142"],
  "created_at": "2026-06-21T15:04:11Z",
  "sealed_at": "2026-06-21T15:04:11Z",
  "disputed": false,
  "dispute_refs": [],
  "integrity": {
    "content_hash": "sha256:1ad9…",
    "prev_receipt_hash": "sha256:0c77…",
    "chain_index": 10482,
    "ledger_checkpoint_id": "ckpt_2026-06-21T15:00Z",
    "signature": "hmac:7b22…"
  },
  "redaction": {
    "pii_redacted": true,
    "redaction_policy_id": "redpol_default_v3",
    "scrubbed_fields": ["action.payload_preview.body", "evidence[*].raw"]
  }
}
```

---

## 3. Evidence items & tags

Evidence is the heart of the differentiation. An agent does not just "send an
email" — it sends an email **because it believed certain things**. Each of
those beliefs is an **Evidence Item**, and each item is **tagged with its
epistemic status**.

### 3.1 The three evidence tags

| Tag | Meaning | Bar to qualify | Allowed to drive consequential actions? |
|---|---|---|---|
| `verified_fact` | Directly observed from a trusted source of record. | Came from a `source` with a verifiable read, value unchanged, within freshness window. | Yes. |
| `likely_inference` | Derived/estimated by the agent or a model. | A reasoning step or model output, not directly observed. Must carry `confidence` and `reasoning`. | Yes, **only** if policy permits inference for that action type; otherwise downgraded or blocked. |
| `unknown` | Needed but unavailable, stale, or unverifiable. | Could not be sourced, or source failed freshness/trust checks. | No — actions must not depend on `unknown` evidence; they degrade gracefully or block. |

This taxonomy is the contract: **a reviewer can scan the `evidence` array and
immediately see what Cognitia *knew* versus what it *guessed* versus what it
*didn't know*.** Alta's logs do not distinguish these; ours make it the
primary axis.

### 3.2 Evidence item schema

| Field | Type | Description |
|---|---|---|
| `evidence_id` | string (`ev_`) | Unique. |
| `claim` | string | The proposition relied upon, e.g. "Lead requested a demo on 2026-06-19." |
| `tag` | enum | `verified_fact` \| `likely_inference` \| `unknown`. |
| `source_ref` | string (`src_`) | The source this came from (§4). Null only for pure inference. |
| `observed_value_hash` | string | SHA-256 of the observed value (raw value stays in vault). |
| `observed_at` | RFC3339 | When the value was read/derived. |
| `freshness_sec` | int | Age of the underlying data at decision time. |
| `confidence` | float 0–1 | Required for `likely_inference`; optional otherwise. |
| `reasoning` | string | For inferences: how it was derived (redacted of PII). |
| `derived_from` | array<string (`ev_`)> | Parent evidence for chained inferences. |
| `verification` | object | `{ method, verifier, verified_at }` — how it was checked (e.g. `source_read`, `cross_source_match`, `human_confirmed`). |

### 3.3 Promotion / demotion rules

- An inference can be **promoted** to `verified_fact` only if a verification
  step confirms it against a trusted source (`verification.method` set).
- A `verified_fact` is **demoted** to `unknown` if its `freshness_sec`
  exceeds the policy's freshness window at decision time (stale data is not a
  fact).
- The `evidence_summary` counts on the receipt must equal the actual tag
  distribution in `evidence` — replay (§9) recomputes and asserts this.

### 3.4 Example evidence array

```json
[
  {
    "evidence_id": "ev_8f2c01",
    "claim": "Lead requested a demo on 2026-06-19.",
    "tag": "verified_fact",
    "source_ref": "src_crm_hubspot_01",
    "observed_value_hash": "sha256:aa01…",
    "observed_at": "2026-06-21T15:03:58Z",
    "freshness_sec": 169000,
    "verification": { "method": "source_read", "verifier": "crm_connector", "verified_at": "2026-06-21T15:03:58Z" }
  },
  {
    "evidence_id": "ev_8f2c02",
    "claim": "Lead has marketing-email consent on file.",
    "tag": "verified_fact",
    "source_ref": "src_crm_hubspot_01",
    "observed_value_hash": "sha256:bb12…",
    "observed_at": "2026-06-21T15:03:58Z",
    "freshness_sec": 169000,
    "verification": { "method": "source_read", "verifier": "consent_service", "verified_at": "2026-06-21T15:03:58Z" }
  },
  {
    "evidence_id": "ev_8f2c03",
    "claim": "Best-fit persona is 'RevOps Lead', so value-prop A is most relevant.",
    "tag": "likely_inference",
    "source_ref": null,
    "confidence": 0.74,
    "reasoning": "Title field 'Revenue Operations Manager' mapped to RevOps persona; persona→value-prop table selects A.",
    "derived_from": ["ev_8f2c04"],
    "observed_at": "2026-06-21T15:04:02Z"
  },
  {
    "evidence_id": "ev_8f2c05",
    "claim": "Company's current headcount.",
    "tag": "unknown",
    "source_ref": null,
    "observed_at": "2026-06-21T15:04:03Z",
    "reasoning": "Enrichment field empty; no trusted source within freshness window."
  }
]
```

The agent sent the email using only `verified_fact` evidence for the gating
decisions (demo request + consent), used a `likely_inference` only for
*content selection* (which is policy-permitted), and explicitly recorded that
headcount was `unknown` and therefore was **not** used to make any claim in
the email.

---

## 4. Source record

A source record describes **where a piece of evidence came from** and how
trustworthy that origin is. Multiple evidence items can point to one source.

| Field | Type | Description |
|---|---|---|
| `source_id` | string (`src_`) | Unique within tenant. |
| `kind` | enum | `crm` \| `email` \| `calendar` \| `enrichment` \| `web` \| `model` \| `human` \| `internal_db`. |
| `system` | string | Concrete system, e.g. `hubspot`, `salesforce`, `clearbit`. |
| `connector_id` | string | Which Cognitia connector/integration read it. |
| `trust_tier` | enum | `system_of_record` \| `secondary` \| `third_party` \| `unverified`. |
| `read_method` | enum | `api_read` \| `webhook` \| `manual_entry` \| `model_generation`. |
| `record_locator` | object | Pseudonymous pointer: `{ object_type, object_ref, field }` — never a raw URL/email. |
| `retrieved_at` | RFC3339 | When the read happened. |
| `freshness_policy_id` | string | Which freshness rule applies. |
| `auth_context` | object | `{ scope, granted_by, on_behalf_of }` — the authorization under which the read occurred. |
| `content_hash` | string | SHA-256 of the retrieved payload (raw stays in vault). |

`trust_tier` directly informs evidence tagging: only `system_of_record` and
verified `secondary` reads may back a `verified_fact`. A `model` or
`unverified` source can back at most a `likely_inference`.

### Example

```json
{
  "source_id": "src_crm_hubspot_01",
  "kind": "crm",
  "system": "hubspot",
  "connector_id": "conn_hubspot_clientzero",
  "trust_tier": "system_of_record",
  "read_method": "api_read",
  "record_locator": { "object_type": "contact", "object_ref": "subj_c0_000142", "field": "lifecyclestage,hs_marketable_status" },
  "retrieved_at": "2026-06-21T15:03:58Z",
  "freshness_policy_id": "fresh_crm_72h",
  "auth_context": { "scope": "crm.contacts.read", "granted_by": "client_zero_admin", "on_behalf_of": "client_zero" },
  "content_hash": "sha256:cc34…"
}
```

---

## 5. Policy check record

A policy check record captures **one policy evaluation**: which rule ran,
what it was given, and what it decided. A receipt links *all* checks that
were evaluated for the action — passes and failures alike.

| Field | Type | Description |
|---|---|---|
| `policy_check_id` | string (`pol_`) | Unique per evaluation. |
| `policy_id` | string | The rule identity, e.g. `outreach.consent_required`. |
| `policy_version` | string | Version of the rule that ran. |
| `category` | enum | `consent` \| `rate_limit` \| `content_safety` \| `data_access` \| `approval_required` \| `jurisdiction` \| `suppression`. |
| `inputs` | object | The (redacted) facts fed to the rule, with evidence refs. |
| `evidence_refs` | array<string (`ev_`)> | Evidence items the rule depended on. |
| `result` | enum | `pass` \| `fail` \| `warn`. |
| `effect` | enum | `allow` \| `deny` \| `require_approval` \| `apply_condition`. |
| `conditions` | array<object> | If `apply_condition`, what was imposed (e.g. "send window 9am–5pm tenant TZ"). |
| `rationale` | string | Human-readable reason for the result. |
| `evaluated_at` | RFC3339 | When the check ran. |
| `engine_version` | string | Policy engine version for reproducibility. |

The receipt's top-level `policy_verdict` is the **aggregation** of all checks:
any `deny` ⇒ `deny`; else any `apply_condition` ⇒ `allow_with_conditions`;
else `allow`. Replay recomputes this aggregation.

### Example

```json
{
  "policy_check_id": "pol_outreach_consent_88a2",
  "policy_id": "outreach.consent_required",
  "policy_version": "3.2",
  "category": "consent",
  "inputs": { "channel": "email", "consent_status": "granted", "suppression_listed": false },
  "evidence_refs": ["ev_8f2c02"],
  "result": "pass",
  "effect": "allow",
  "conditions": [],
  "rationale": "Marketable consent present and not on suppression list.",
  "evaluated_at": "2026-06-21T15:04:05Z",
  "engine_version": "policy-engine-1.7"
}
```

A second check on the same action might impose a condition:

```json
{
  "policy_check_id": "pol_send_rate_88a2",
  "policy_id": "outreach.rate_limit",
  "policy_version": "1.4",
  "category": "rate_limit",
  "inputs": { "sends_last_24h_to_subject": 0, "tenant_daily_cap_pct": 41 },
  "evidence_refs": [],
  "result": "warn",
  "effect": "apply_condition",
  "conditions": [{ "type": "send_window", "value": "09:00-17:00 America/New_York" }],
  "rationale": "Within caps; constrained to business-hours send window.",
  "evaluated_at": "2026-06-21T15:04:06Z",
  "engine_version": "policy-engine-1.7"
}
```

---

## 6. Approval record

The approval record proves **who or what authorized** a consequential action.
Authorization can be a human click, a standing rule the customer configured,
or an autonomy grant — but it is always explicit and always linked.

| Field | Type | Description |
|---|---|---|
| `approval_id` | string (`appr_`) | Unique. |
| `mode` | enum | `human_in_loop` \| `standing_rule` \| `autonomy_grant` \| `delegated`. |
| `approver` | object | `{ type: human\|policy\|system, id, display_ref }`. `display_ref` is a role/pseudonym, not raw PII. |
| `scope` | object | What was authorized: `{ action_types[], subject_scope, valid_until }`. |
| `basis` | string | Why this approval applies, e.g. "Standing rule: auto-send first follow-ups to inbound demo leads." |
| `granted_at` | RFC3339 | When authorization was established. |
| `evidence_refs` | array<string (`ev_`)> | Evidence the approval relied on (e.g. that the lead is inbound). |
| `policy_refs` | array<string (`pol_`)> | Policy checks that conditioned the approval. |
| `revocable` | bool | Whether it can be revoked. |
| `revoked_at` | RFC3339 | If revoked. |
| `signature` | string | Optional signature binding approver to scope. |

### Approval modes

- **`human_in_loop`** — a named human (by role/pseudonym) clicked approve on
  this specific action. Highest assurance.
- **`standing_rule`** — the customer pre-authorized a class of actions under
  stated conditions; the matching conditions are captured in `scope`/`basis`.
- **`autonomy_grant`** — the agent operates autonomously within a bounded
  envelope the customer granted (action types, volume, value caps,
  reversibility). The envelope is in `scope`.
- **`delegated`** — authority passed from another approval (chained), with the
  parent referenced in `basis`.

### Example (standing rule)

```json
{
  "approval_id": "appr_7a1d",
  "mode": "standing_rule",
  "approver": { "type": "human", "id": "usr_c0_admin", "display_ref": "ClientZero / RevOps Admin" },
  "scope": {
    "action_types": ["email.send"],
    "subject_scope": "lifecyclestage=lead AND source=inbound_demo_request",
    "valid_until": "2026-12-31T23:59:59Z"
  },
  "basis": "Standing rule R-114: auto-send first follow-up to inbound demo leads with consent.",
  "granted_at": "2026-06-01T12:00:00Z",
  "evidence_refs": ["ev_8f2c01", "ev_8f2c02"],
  "policy_refs": ["pol_outreach_consent_88a2"],
  "revocable": true,
  "revoked_at": null,
  "signature": "hmac:51aa…"
}
```

---

## 7. CRM / writeback record

When an action writes to an external system of record, the writeback record
proves **exactly what changed**, **whether it was confirmed**, and **how to
reverse it**.

| Field | Type | Description |
|---|---|---|
| `writeback_id` | string (`wb_`) | Unique. |
| `target_system` | string | e.g. `hubspot`. |
| `connector_id` | string | Connector that performed the write. |
| `operation` | enum | `create` \| `update` \| `upsert` \| `delete` \| `note` \| `task` \| `activity_log`. |
| `object_type` | string | e.g. `contact`, `deal`, `engagement`. |
| `object_ref` | string (`subj_`/`obj_`) | Pseudonymous target object. |
| `field_changes` | array<object> | `{ field, before_hash, after_hash, after_preview }` — values hashed; only redacted preview shown. |
| `idempotency_key` | string | Prevents duplicate writes on retry. |
| `request_hash` | string | SHA-256 of the canonical write request. |
| `external_id` | string | ID/receipt returned by the target system. |
| `confirmation` | object | `{ status: confirmed\|pending\|failed, confirmed_at, http_status }`. |
| `reversible` | bool | Whether a compensating action exists. |
| `compensation_ref` | string | Handle for the undo/compensation. |
| `wrote_at` | RFC3339 | When the write executed. |

> **Before/after as hashes.** Field-level changes record `before_hash` and
> `after_hash` so a reviewer can prove a value changed (and to what, if they
> hold the value) **without** the receipt ever storing raw PII. A short
> redacted `after_preview` aids human reading.

### Example

```json
{
  "writeback_id": "wb_44ce",
  "target_system": "hubspot",
  "connector_id": "conn_hubspot_clientzero",
  "operation": "activity_log",
  "object_type": "engagement",
  "object_ref": "subj_c0_000142",
  "field_changes": [
    { "field": "last_email_sent_at", "before_hash": "sha256:00…", "after_hash": "sha256:7d…", "after_preview": "2026-06-21T15:04:11Z" },
    { "field": "email_sequence_step", "before_hash": "sha256:1a…", "after_hash": "sha256:2b…", "after_preview": "1" }
  ],
  "idempotency_key": "ik_act_88a2",
  "request_hash": "sha256:e4c0…",
  "external_id": "hs_eng_99281",
  "confirmation": { "status": "confirmed", "confirmed_at": "2026-06-21T15:04:12Z", "http_status": 201 },
  "reversible": true,
  "compensation_ref": "comp_wb_44ce",
  "wrote_at": "2026-06-21T15:04:11Z"
}
```

---

## 8. Blocked-action record

When the agent is **prevented** from acting, that is recorded with the same
rigor as a successful action. Blocks are first-class evidence: they prove the
guardrails fire. The parent receipt has `outcome = blocked` and a
`blocked_ref`.

| Field | Type | Description |
|---|---|---|
| `blocked_id` | string (`blk_`) | Unique. |
| `attempted_action` | object | Same shape as receipt `action`, marked `simulated`. |
| `block_reason` | enum | `policy_deny` \| `missing_approval` \| `unknown_evidence` \| `stale_evidence` \| `suppression` \| `rate_limit` \| `kill_switch` \| `connector_error`. |
| `triggering_policy_refs` | array<string (`pol_`)> | Policy checks that produced the deny. |
| `missing_requirements` | array<string> | What was needed but absent (e.g. "human approval", "fresh consent"). |
| `evidence_refs` | array<string (`ev_`)> | Evidence relevant to the block (incl. `unknown`/stale items). |
| `safe_state` | string | What the agent did instead (e.g. "queued for human review"). |
| `escalation_ref` | string | Task/queue the block routed to, if any. |
| `blocked_at` | RFC3339 | When the block occurred. |

### Example

```json
{
  "blocked_id": "blk_19ab",
  "attempted_action": {
    "action_id": "act_88c0",
    "type": "email.send",
    "category": "consequential",
    "target_system": "gmail",
    "payload_preview": { "to": "subj_c0_000311", "subject": "Re: pricing" },
    "reversible": false
  },
  "block_reason": "unknown_evidence",
  "triggering_policy_refs": ["pol_outreach_consent_88c0"],
  "missing_requirements": ["verified marketing-email consent"],
  "evidence_refs": ["ev_consent_unknown_311"],
  "safe_state": "Did not send; routed to human review queue.",
  "escalation_ref": "task_review_4471",
  "blocked_at": "2026-06-21T15:09:44Z"
}
```

---

## 9. Replay / audit process

Replay is what turns a receipt from "a record" into **proof**. Any sealed
receipt can be deterministically re-evaluated against its captured inputs to
confirm that the recorded decision is the decision the rules actually
produce.

### 9.1 What replay reconstructs

Given a `receipt_id`, the replay engine:

1. **Loads the frozen inputs** — the evidence items, their
   `observed_value_hash`es, source records, and the exact `policy_version`s
   and `engine_version` recorded on each policy check.
2. **Re-runs the policy checks** against those frozen inputs using the
   *pinned* policy versions (not today's policies).
3. **Re-aggregates** the `policy_verdict` and compares it to the stored
   verdict.
4. **Recomputes `evidence_summary`** tag counts and compares.
5. **Re-checks authorization** — that an approval with matching scope existed
   and was unrevoked at `created_at`.
6. **Verifies integrity** — recomputes `content_hash`, checks
   `prev_receipt_hash` linkage and `chain_index` continuity.

### 9.2 Replay verdict

Replay emits a `ReplayReport`:

| Field | Type | Description |
|---|---|---|
| `replay_id` | string | Unique. |
| `receipt_id` | string | Subject receipt. |
| `result` | enum | `consistent` \| `inconsistent` \| `integrity_failure`. |
| `checks` | array<object> | Per-assertion `{ name, expected, actual, pass }`. |
| `integrity_ok` | bool | Hash-chain verification result. |
| `policy_reproduced` | bool | Whether re-run matched stored verdict. |
| `replayed_at` | RFC3339 | When replay ran. |
| `notes` | string | Discrepancy detail if any. |

- `consistent` — the recorded decision is reproducible and the chain is
  intact. This is the proof.
- `inconsistent` — inputs are intact but the recorded verdict doesn't match a
  re-run (a real finding — bug or manipulation). Auto-opens a dispute (§10).
- `integrity_failure` — the hash chain doesn't verify; the record was altered
  after sealing. Highest-severity finding.

### 9.3 Determinism guarantees

- Policy checks run against **frozen inputs** with **pinned versions**, so
  replay is deterministic even though live policies evolve.
- Model-produced `likely_inference` items are **not re-sampled** during
  replay (LLMs are nondeterministic). Replay verifies the *recorded*
  inference's hash, confidence, and that policy permitted an inference of that
  type — it does not regenerate the model output. What's proven is "an
  inference of confidence X was used where policy allowed it," not "the model
  would say the same thing again."

### 9.4 Ledger checkpoints

Periodically (e.g. hourly) the tenant ledger emits a **checkpoint**: a record
binding `{ chain_index_range, merkle_root_or_running_hash, checkpoint_hash,
created_at }`. Checkpoints make audits cheap — an auditor verifies the small
set of checkpoints, then spot-verifies receipts under each. Checkpoints may
optionally be co-signed or notarized internally; **no external chain/token is
involved**.

### 9.5 Who can replay

- **Customer** — self-serve replay of any receipt in their tenant.
- **Cognitia auditor** — replay across receipts for investigations.
- **Third-party auditor** — scoped, read-only replay access, time-boxed.

Every replay is itself logged (read-only access leaves an audit trail).

---

## 10. Dispute lifecycle

A **Dispute** is a formal challenge to one or more receipts: "this action was
wrong / unauthorized / harmful." Disputes are how the proof layer handles
contested reality.

### 10.1 States

```
   opened ──► triaged ──► investigating ──► resolved ──► closed
      │                        │                ▲
      │                        ▼                │
      └────────────────► needs_info ────────────┘
                             (await requester)
```

| State | Meaning |
|---|---|
| `opened` | A dispute was filed against ≥1 receipt. |
| `triaged` | Severity/category assigned; receipts frozen from auto-cleanup. |
| `investigating` | Replay + human review underway. |
| `needs_info` | Awaiting input from requester or customer. |
| `resolved` | Outcome decided with documented finding. |
| `closed` | Resolution acknowledged / appeal window passed. |

### 10.2 Dispute record schema

| Field | Type | Description |
|---|---|---|
| `dispute_id` | string (`disp_`) | Unique. |
| `tenant_id` | string | Tenant. |
| `receipt_refs` | array<string (`rcpt_`)> | Receipts under dispute. |
| `opened_by` | object | `{ type: customer\|subject_rep\|cognitia\|auto_replay, display_ref }`. |
| `reason_code` | enum | `unauthorized_action` \| `wrong_evidence` \| `consent_violation` \| `factual_error` \| `harm_claim` \| `integrity_alert` \| `other`. |
| `description` | string | Free-text claim (redacted of PII). |
| `state` | enum | See 10.1. |
| `severity` | enum | `low` \| `medium` \| `high` \| `critical`. |
| `opened_at` | RFC3339 | Filing time. |
| `sla_due_at` | RFC3339 | When a resolution is due. |
| `replay_refs` | array<string> | Replays run during investigation. |
| `timeline` | array<object> | Append-only `{ at, actor, event, note }` entries. |
| `resolution` | object | See 10.3. Null until resolved. |

### 10.3 Resolution object

| Field | Type | Description |
|---|---|---|
| `outcome` | enum | `upheld` \| `overturned` \| `partially_upheld` \| `no_fault` \| `inconclusive`. |
| `finding` | string | What the investigation concluded. |
| `root_cause` | enum | `policy_gap` \| `bad_evidence` \| `connector_error` \| `model_error` \| `approval_misconfig` \| `no_defect` \| `tampering`. |
| `remediation` | array<object> | Actions taken: e.g. compensating writeback, policy update, suppression. |
| `compensation_refs` | array<string> | Writeback reversals/compensations executed. |
| `affected_subject_refs` | array<string (`subj_`)> | Pseudonymous subjects affected. |
| `resolved_by` | object | Reviewer (role/pseudonym). |
| `resolved_at` | RFC3339 | Resolution time. |
| `appealable` | bool | Whether the requester may appeal. |

### 10.4 Lifecycle behavior

- **Opening** freezes targeted receipts from any retention cleanup and sets
  `disputed = true` on each.
- **Auto-open:** a replay result of `inconsistent` or `integrity_failure`
  opens a `critical` dispute automatically with `reason_code =
  integrity_alert` and `opened_by.type = auto_replay`.
- **Investigation** is replay-driven (§9). The replay reports are attached.
- **Resolution** may trigger **remediation** — a *new* consequential action
  (e.g. a compensating writeback to undo a bad CRM change) which itself emits
  its own Proof Receipt. Remediation is never silent.
- **Immutability:** disputes never edit the disputed receipts. They *annotate*
  via references. The original receipt stays sealed; the dispute holds the
  corrective story.

### 10.5 Example

```json
{
  "dispute_id": "disp_03fe",
  "tenant_id": "client_zero",
  "receipt_refs": ["rcpt_01J9Z3Q8M4F0RABCDEF12345"],
  "opened_by": { "type": "customer", "display_ref": "ClientZero / RevOps Admin" },
  "reason_code": "consent_violation",
  "description": "Lead says they never requested a demo and want to know why they were emailed.",
  "state": "resolved",
  "severity": "high",
  "opened_at": "2026-06-22T09:10:00Z",
  "sla_due_at": "2026-06-24T09:10:00Z",
  "replay_refs": ["replay_77a1"],
  "timeline": [
    { "at": "2026-06-22T09:10:00Z", "actor": "ClientZero/Admin", "event": "opened", "note": "Consent challenge." },
    { "at": "2026-06-22T09:32:00Z", "actor": "cognitia/auditor", "event": "replay_run", "note": "Replay consistent; consent + demo-request verified_facts intact." },
    { "at": "2026-06-22T10:05:00Z", "actor": "cognitia/auditor", "event": "resolved", "note": "No fault: action backed by verified consent and demo request." }
  ],
  "resolution": {
    "outcome": "no_fault",
    "finding": "Receipt replays consistent. Demo request (ev_8f2c01) and marketing consent (ev_8f2c02) were verified_facts from the system of record at send time. Action was authorized by standing rule R-114.",
    "root_cause": "no_defect",
    "remediation": [{ "type": "suppression", "detail": "Added subject to do-not-contact at requester's request, going forward." }],
    "compensation_refs": [],
    "affected_subject_refs": ["subj_c0_000142"],
    "resolved_by": { "type": "human", "display_ref": "cognitia/auditor" },
    "resolved_at": "2026-06-22T10:05:00Z",
    "appealable": true
  }
}
```

This is the punchline of the whole design: when challenged, Cognitia didn't
argue — it **replayed the receipt** and showed the verified facts and the
authorization. The lead still got added to do-not-contact (customer's call),
but there was **no ambiguity about what happened or why it was allowed**.

---

## 11. Proof report export

A **Proof Report** is a portable, human- and machine-readable bundle that
packages everything needed to verify a receipt (or a set of them) outside
Cognitia's UI — for a customer's compliance team, an auditor, or a buyer's
security review.

### 11.1 Contents

A report bundle (`.json` + rendered `.pdf`/`.html`) contains, for each
included receipt:

- the **receipt** and all linked records (evidence, sources, approval, policy
  checks, writeback, blocks),
- the **evidence summary** with the `verified_fact / likely_inference /
  unknown` breakdown front and center,
- any **disputes** and their resolutions,
- the **replay report**(s) and the **integrity verification** (chain segment +
  checkpoint),
- a **redaction manifest** confirming no raw PII is present,
- a **verification guide** so a third party can recompute hashes themselves.

### 11.2 Export record schema

| Field | Type | Description |
|---|---|---|
| `report_id` | string (`rep_`) | Unique. |
| `tenant_id` | string | Tenant. |
| `scope` | object | `{ receipt_ids[] }` or `{ query, time_range }`. |
| `included_receipts` | int | Count. |
| `formats` | array | e.g. `["json", "pdf"]`. |
| `integrity_summary` | object | `{ chain_verified, checkpoints[], any_integrity_failures }`. |
| `evidence_rollup` | object | Aggregate tag counts across the report. |
| `dispute_rollup` | object | `{ open, resolved, upheld, overturned }`. |
| `redaction_attestation` | object | `{ pii_redacted: true, policy_id, verified_by }`. |
| `generated_by` | object | Role/pseudonym. |
| `generated_at` | RFC3339 | Time. |
| `bundle_hash` | string | SHA-256 over the whole bundle (so the export itself is tamper-evident). |
| `signature` | string | Optional signature over `bundle_hash`. |

### 11.3 Verification guide (shipped in every bundle)

A short, fixed appendix telling the recipient how to independently verify:

1. Recompute each receipt's `content_hash`; confirm it matches `integrity.content_hash`.
2. Walk `prev_receipt_hash` across the included chain segment; confirm linkage.
3. Confirm each segment endpoint matches its `ledger_checkpoint`.
4. Recompute the `bundle_hash`; confirm signature.
5. Scan for the redaction attestation; confirm no raw PII fields are present.

A recipient who completes these steps has **mathematically verified** what the
agent did and that the record wasn't altered — without trusting Cognitia's
word and without any blockchain.

---

## 12. Privacy & PII handling (summary)

- Receipts store **pseudonymous `subj_` refs**, **`*_hash` digests**, and
  **redacted previews** only. Raw values live in the tenant's isolated
  identity/value vault, separate from the ledger.
- The `subj_` ↔ identity mapping never appears in a receipt, report, or
  replay output.
- `redaction.scrubbed_fields` and the report's `redaction_attestation` make
  the privacy posture auditable.
- Before/after proof uses hashes, so a reviewer can prove *that* a value
  changed without the receipt holding the value.
- All examples in this document use the synthetic **Client Zero** tenant. No
  live customer data appears anywhere in the proof layer's documentation or
  fixtures.

---

## 13. Client Zero happy-path proof receipt (worked example)

**Scenario (all fake data):** Client Zero's inbound lead `subj_c0_000142`
("Jordan Avery, Revenue Operations Manager" — synthetic) requested a demo on
2026-06-19. On 2026-06-21 the Cognitia SDR agent decides to send a first
follow-up email. Consent is on file. A standing rule pre-authorizes the send.
The send happens, HubSpot is updated, and a receipt is sealed. Later a consent
question is raised and resolved by replay with **no fault**.

### 13.1 The decision, narrated by the receipt

1. **Evidence gathered & tagged**
   - `verified_fact`: demo requested 2026-06-19 (`ev_8f2c01`, from HubSpot,
     system of record).
   - `verified_fact`: marketing-email consent granted (`ev_8f2c02`).
   - `likely_inference` (conf 0.74): persona = RevOps ⇒ value-prop A
     (`ev_8f2c03`) — used only for *content selection*, which policy permits.
   - `unknown`: company headcount (`ev_8f2c05`) — **not used** in any claim.
2. **Sources recorded** — `src_crm_hubspot_01` (system_of_record).
3. **Policy checks** — consent `pass/allow`; rate limit `warn/apply_condition`
   (business-hours window); content safety `pass/allow`. Aggregate verdict:
   `allow_with_conditions`.
4. **Approval** — standing rule R-114 (`appr_7a1d`) authorizes auto-send of
   first follow-ups to consented inbound demo leads.
5. **Action taken** — `email.send`, `outcome = taken`, constrained to the send
   window.
6. **Writeback** — HubSpot engagement logged + sequence step advanced
   (`wb_44ce`, confirmed).
7. **Sealed** — receipt hashed into the Client Zero ledger at `chain_index
   10482`.

### 13.2 The sealed receipt (fake data)

```json
{
  "receipt_id": "rcpt_01J9Z3Q8M4F0RABCDEF12345",
  "schema_version": "1.0",
  "tenant_id": "client_zero",
  "run_id": "run_2f90a1c7",
  "agent": {
    "agent_id": "agt_sdr_01",
    "agent_name": "Cognitia SDR",
    "agent_version": "2026.06.0",
    "model_id": "claude-opus-4-8"
  },
  "action": {
    "action_id": "act_88a2",
    "type": "email.send",
    "category": "consequential",
    "target_system": "gmail",
    "payload_preview": {
      "to": "subj_c0_000142",
      "subject": "Following up on your demo request",
      "body_preview": "Hi [REDACTED_FIRST_NAME], thanks for requesting a look at Cognitia…"
    },
    "payload_hash": "sha256:9f1b8c…",
    "reversible": false,
    "undo_ref": null
  },
  "outcome": "taken",
  "intent": "Send first follow-up email to consented inbound demo lead.",
  "evidence": [
    { "evidence_id": "ev_8f2c01", "claim": "Lead requested a demo on 2026-06-19.", "tag": "verified_fact", "source_ref": "src_crm_hubspot_01", "observed_value_hash": "sha256:aa01…", "observed_at": "2026-06-21T15:03:58Z", "freshness_sec": 169000, "verification": { "method": "source_read", "verifier": "crm_connector", "verified_at": "2026-06-21T15:03:58Z" } },
    { "evidence_id": "ev_8f2c02", "claim": "Lead has marketing-email consent on file.", "tag": "verified_fact", "source_ref": "src_crm_hubspot_01", "observed_value_hash": "sha256:bb12…", "observed_at": "2026-06-21T15:03:58Z", "freshness_sec": 169000, "verification": { "method": "source_read", "verifier": "consent_service", "verified_at": "2026-06-21T15:03:58Z" } },
    { "evidence_id": "ev_8f2c03", "claim": "Persona=RevOps ⇒ value-prop A is most relevant.", "tag": "likely_inference", "source_ref": null, "confidence": 0.74, "reasoning": "Title 'Revenue Operations Manager' → RevOps persona → value-prop table selects A.", "derived_from": ["ev_8f2c04"], "observed_at": "2026-06-21T15:04:02Z" },
    { "evidence_id": "ev_8f2c05", "claim": "Company headcount.", "tag": "unknown", "source_ref": null, "observed_at": "2026-06-21T15:04:03Z", "reasoning": "Enrichment field empty; no trusted source within freshness window. Not used in email." }
  ],
  "evidence_summary": { "verified_fact": 2, "likely_inference": 1, "unknown": 1 },
  "approval_ref": "appr_7a1d",
  "policy_checks": ["pol_outreach_consent_88a2", "pol_send_rate_88a2", "pol_content_safety_88a2"],
  "policy_verdict": "allow_with_conditions",
  "writeback_ref": "wb_44ce",
  "blocked_ref": null,
  "subject_refs": ["subj_c0_000142"],
  "created_at": "2026-06-21T15:04:11Z",
  "sealed_at": "2026-06-21T15:04:11Z",
  "disputed": false,
  "dispute_refs": [],
  "integrity": {
    "content_hash": "sha256:1ad9f0…",
    "prev_receipt_hash": "sha256:0c77ab…",
    "chain_index": 10482,
    "ledger_checkpoint_id": "ckpt_2026-06-21T15:00Z",
    "signature": "hmac:7b22e1…"
  },
  "redaction": {
    "pii_redacted": true,
    "redaction_policy_id": "redpol_default_v3",
    "scrubbed_fields": ["action.payload_preview.body", "evidence[*].raw_value"]
  }
}
```

### 13.3 What a reviewer concludes

Reading just this one receipt (and replaying it), a reviewer can state, with
proof:

- **What the agent did:** sent one follow-up email to `subj_c0_000142` and
  logged it to HubSpot (`wb_44ce`, confirmed).
- **What it knew vs guessed:** two **verified facts** (demo request + consent)
  gated the decision; one **inference** chose the messaging; one field was
  **unknown** and deliberately unused.
- **Why it was allowed:** standing rule **R-114** authorized it, and three
  policy checks evaluated to `allow_with_conditions` (business-hours send
  window).
- **That nothing was tampered with:** the receipt's `content_hash` links to
  the prior receipt and rolls up to checkpoint `ckpt_2026-06-21T15:00Z`;
  replay returns `consistent`.
- **How a challenge resolves:** the later consent dispute (`disp_03fe`)
  replayed `consistent` and closed `no_fault`, with a forward-looking
  suppression added at the customer's request.

That is the bar in the acceptance criteria: *a reviewer understands exactly
how Cognitia proves what an agent did and why it was allowed.*

---

## 14. Why this is stronger than Alta (recap)

| Capability | Typical agent vendor / Alta | Cognitia Proof Receipt & Dispute Layer |
|---|---|---|
| Action record | Flat event log | Structured, linked **receipt graph** per action |
| Belief transparency | None | Every claim tagged `verified_fact` / `likely_inference` / `unknown` |
| Authorization proof | Implicit | Explicit **approval record** with scope & basis |
| Policy transparency | Hidden | Every **policy check** recorded, pass and fail |
| What was *blocked* | Invisible | First-class **blocked-action records** |
| Re-verifiability | "Trust the log" | Deterministic **replay** against frozen inputs |
| Tamper-evidence | Usually none | **Hash-linked ledger** + checkpoints (no blockchain) |
| Contesting an action | Support ticket | Formal **dispute lifecycle** with documented resolution |
| Portability | Screenshots | Signed, self-verifiable **proof report export** |
| Privacy | Often raw PII in logs | Pseudonymous refs + hashes; **no raw PII** in receipts |

---

## 15. Open questions / future work

- **Cross-tenant proof aggregation** for partners acting across tenants.
- **Selective disclosure** in exports (prove a property of a value without
  revealing it) — achievable with plain hash commitments; no chain needed.
- **Standing-rule simulation**: dry-run a proposed autonomy grant against
  historical receipts to forecast what would have been auto-sent vs blocked.
- **SLA automation** for dispute states and auto-escalation on
  `integrity_failure`.
