# Agent Action Passport

**Status:** Internal architecture specification
**Scope:** Cognitia agent runtime (Hermes pipeline and successors)
**Last updated:** 2026-06-21

---

## 1. What this is

The **Agent Action Passport** (AAP) is Cognitia's internal, server-side
authorization envelope that travels with every agent run. It declares —
before any tool fires — *who* the agent is, *which tenant* it acts for,
*what it is allowed to touch*, *for how long*, *under what approvals*, and
*what it must record afterward*.

It is a **policy object**, not a credential the agent carries around. The
agent never holds the passport's signing material; the runtime resolves,
validates, and enforces the passport on the agent's behalf at each tool
boundary.

Think of it as the contract the orchestrator hands the enforcement layer:
"This run is permitted to do exactly these things, and nothing else."

### 1.1 What this is NOT — hard rule

This boundary is non-negotiable and must be preserved in every future
revision of this document and its implementation:

- ❌ **Not a wallet.** It holds no keys, no balances, no signing authority
  over funds. The `budget` field is an accounting *ceiling* enforced by
  Cognitia's own metering — not a spendable instrument.
- ❌ **Not a public token.** It is never minted, transferred, sold, or
  exposed to third parties. It has no value outside Cognitia's runtime and
  is meaningless if extracted.
- ❌ **Not a payment passport.** It does not authorize, settle, or route
  any payment. Cost guards cap *internal resource consumption*, not money
  movement.
- ❌ **Not chain-dependent.** It does not require, reference, or assume any
  blockchain, ledger, on-chain identity, or distributed consensus. It is a
  plain server-side record in Cognitia's own store.

If a future change would turn any field into a bearer instrument,
on-chain artifact, or externally-redeemable token, that change is **out of
scope for the AAP** and must be designed as a separate, clearly-named
system.

---

## 2. Design goals

1. **Least privilege by default.** A passport with no explicit grants
   permits nothing. Every capability is opt-in.
2. **Deny-by-default enforcement.** If a requested action is not
   explicitly inside an allow scope, it is blocked — even if it is not on
   the blocklist.
3. **Auditability.** Every consequential action produces a receipt linked
   back to the passport that authorized it.
4. **Tenant isolation.** No passport can read or act across tenant
   boundaries. `tenant_id` is the root of every scope check.
5. **Safe-by-construction testing.** A passport defaults to mock mode;
   live side effects require an explicit, deliberate flip.

---

## 3. Passport fields

The passport is a structured object. The canonical representation is JSON
held in Cognitia's runtime store; the shape below is illustrative, not a
code artifact.

### 3.1 `agent_id`

Stable identifier of the agent definition this run instantiates (e.g.
`hermes.video-producer`, `hermes.vision-qc`). Identifies *what kind of
agent* is acting and which capability profile it draws from. Distinct from
the per-run execution ID.

### 3.2 `tenant_id`

The tenant on whose behalf the agent acts. This is the **root of all scope
resolution**. Every data read, channel send, and action check is evaluated
relative to this tenant. A passport is invalid without it, and no scope
entry may resolve to data or channels owned by a different tenant.

### 3.3 `allowed_data_scope`

What data the agent may read and/or write. Expressed as explicit,
tenant-relative resource selectors — never wildcards across tenants.

| Sub-field        | Meaning                                                  |
| ---------------- | -------------------------------------------------------- |
| `read`           | Resource selectors the agent may read                    |
| `write`          | Resource selectors the agent may create/update           |
| `pii_classes`    | Which sensitivity classes (if any) are in scope          |
| `redaction`      | Required redaction policy applied before data leaves run |

Anything not listed is unreadable and unwritable. Cross-tenant selectors
are rejected at validation time, not at access time.

### 3.4 `allowed_channel_scope`

Which outbound/inbound channels the agent may use (e.g. a specific Slack
channel, a single sender mailbox, one publishing destination). Channels
are named explicitly. The agent cannot reach a channel that is not in this
list, and it cannot broaden the list at runtime.

### 3.5 `allowed_action_scope`

The verbs the agent may perform, named at the capability level (e.g.
`render_video`, `draft_email`, `post_comment`, `read_crm_record`). Each
entry may carry per-action constraints (rate caps, size caps,
destination filters). An action verb absent from this list is blocked
regardless of whether the underlying tool is technically reachable.

### 3.6 `time_window`

The validity window for the passport.

| Sub-field     | Meaning                                                |
| ------------- | ------------------------------------------------------ |
| `not_before`  | Earliest instant the passport is valid                 |
| `not_after`   | Hard expiry; all actions blocked after this instant    |
| `max_runtime` | Maximum wall-clock duration of a single run            |
| `timezone`    | Reference timezone for any window expressed in local   |

Outside the window, the enforcement layer refuses every action. Expiry is
checked at each tool boundary, not only at start, so long runs cannot
outlive their window.

### 3.7 `approval_requirements`

Which actions require a human (or higher-authority service) to approve
before they execute. Approvals are **pre-conditions**, evaluated at the
tool boundary.

| Sub-field         | Meaning                                                   |
| ----------------- | -------------------------------------------------------- |
| `gated_actions`   | Action verbs that cannot run without approval            |
| `approver_roles`  | Who is allowed to approve each gated action               |
| `quorum`          | How many approvals are required (default 1)               |
| `expiry`          | How long a granted approval stays valid                  |
| `on_timeout`      | Behavior if approval is not granted in time (`block`)     |

Default `on_timeout` is `block`. An approval is bound to the specific
action, passport, and run that requested it; it does not carry over to
other runs.

### 3.8 `budget` / cost guard

An **internal** consumption ceiling for the run. This is metering, not
money.

| Sub-field         | Meaning                                                   |
| ----------------- | -------------------------------------------------------- |
| `max_tokens`      | Cap on model token consumption                            |
| `max_tool_calls`  | Cap on total tool invocations                            |
| `max_cost_units`  | Cap in Cognitia's internal accounting units              |
| `max_external`    | Cap on calls to metered external providers                |
| `on_exceed`       | Behavior at ceiling (`block` and require re-authorization)|

When any ceiling is reached, the run is halted and the action that would
breach it is refused. Re-authorization issues a *new* passport; ceilings
are not silently raised mid-run. `max_cost_units` denominates internal
resource accounting only — it never authorizes a payment.

### 3.9 `blocked_actions`

An explicit denylist that overrides everything. If an action verb appears
here, it is refused even if it would otherwise be inside
`allowed_action_scope`. Used for hard prohibitions (e.g. `delete_source`,
`publish_when_secret_visible`, `send_to_external_recipient`).

**Precedence:** `blocked_actions` > `allowed_*` scopes > default-deny.

### 3.10 `receipt_requirements`

What evidence must be produced after a consequential action. Receipts are
the audit spine that links outcomes back to the authorizing passport.

| Sub-field          | Meaning                                                  |
| ------------------ | ------------------------------------------------------- |
| `required_for`     | Action verbs that must emit a receipt                    |
| `fields`           | Mandatory receipt contents (inputs hash, outputs ref,   |
|                    | timestamp, agent_id, tenant_id, passport ref, mode)     |
| `sink`             | Where receipts are written (tenant-scoped audit store)   |
| `failure_policy`   | What happens if a receipt cannot be written (`block`)    |

If `failure_policy` is `block`, an action that cannot produce its required
receipt is not allowed to take effect. No receipt, no action.

### 3.11 `mode` (mock / live flag)

A first-class flag that determines whether tool calls produce real side
effects.

| Value  | Behavior                                                        |
| ------ | -------------------------------------------------------------- |
| `mock` | Tools are simulated; no external side effects; receipts marked |
|        | `mode: mock`. **This is the default.**                         |
| `live` | Tools execute for real; requires explicit, deliberate opt-in   |

Defaulting to `mock` makes accidental real-world effects structurally hard
rather than merely discouraged. Flipping to `live` is an explicit decision
and is itself recorded in the run's receipts.

---

## 4. Enforcement model

The passport is evaluated by the runtime, not trusted to the agent. At
**every tool boundary** the enforcement layer runs the following checks, in
order, and any failure refuses the action:

1. **Validity** — passport is well-formed, signed by the runtime, and
   within `time_window`.
2. **Tenant** — the target resource/channel belongs to `tenant_id`.
3. **Blocklist** — the action verb is not in `blocked_actions`.
4. **Scope** — the verb is in `allowed_action_scope`, and any
   data/channel it touches is inside `allowed_data_scope` /
   `allowed_channel_scope`.
5. **Budget** — executing the action would not breach any cost-guard
   ceiling.
6. **Approval** — if the verb is gated, a valid approval exists.
7. **Mode** — if `mode: mock`, the call is simulated; if `live`, it
   proceeds.
8. **Receipt** — after the action, the required receipt is written; if it
   cannot be, the effect is blocked/rolled back per `failure_policy`.

Every step is **deny-by-default**: anything not explicitly permitted is
refused.

---

## 5. Lifecycle

1. **Issue** — the orchestrator mints a passport for a specific run,
   scoped to one `tenant_id` and one `agent_id`, defaulting to `mock`.
2. **Bind** — the passport is bound to the run; the agent receives only a
   reference, never the signing material.
3. **Enforce** — the runtime checks the passport at each tool boundary
   (Section 4).
4. **Record** — receipts accumulate against the passport for the life of
   the run.
5. **Expire/Revoke** — the passport ends at `not_after`, on `max_runtime`,
   on budget exhaustion, or on explicit revocation. Continued work
   requires a fresh passport.

A passport is single-run and non-transferable. There is nothing to
"carry" between runs or tenants.

---

## 6. Future compatibility — parked R&D only

The following are **not requirements and not on the roadmap.** They are
recorded so future contributors know the boundary has been considered.
None of them change the hard rule in Section 1.1: the AAP stays an
internal, off-chain policy object.

- **MCP (Model Context Protocol).** The AAP's `allowed_action_scope` and
  `allowed_channel_scope` map conceptually onto MCP tool/server allowlists.
  *If* Cognitia ever exposes agents over MCP, the passport would sit
  *above* the MCP layer as the policy that decides which MCP tools a run
  may call — the passport is not itself an MCP construct. **Parked.**

- **x402.** x402-style per-request payment challenges are a *payment*
  mechanism. The AAP deliberately does **not** authorize payments; its
  budget field is internal metering. *If* a future product needed metered
  paid calls, x402 would be a **separate** settlement layer that an action
  could invoke only after the passport already permitted that action — the
  passport would never become an x402 token. **Parked.**

- **AP2 (Agent Payments Protocol).** AP2-style mandates describe delegated
  *payment* authority for agents. The AAP is explicitly the non-payment
  counterpart: authority over *actions, data, and channels*, not money. *If*
  payment delegation were ever needed, it would be a distinct mandate
  object referenced alongside — never merged into — the passport, keeping
  the wallet/payment concerns fully outside the AAP. **Parked.**

In all three cases the integration shape is the same: the AAP remains the
internal, off-chain, deny-by-default policy gate, and any payment or
external-protocol concern lives in a separate, clearly-named layer that the
passport can gate but never becomes.
