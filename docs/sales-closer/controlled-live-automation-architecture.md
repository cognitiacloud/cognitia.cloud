# Controlled-Live Automation Architecture

Status labels used below: **REAL** (in production use / tested pure logic),
**SANDBOX** (Tenant Zero / `budget_wheels_demo` only), **MOCK** (in-memory
fake, no IO), **PLANNED** (not built; future legally-reviewed lane).

Branch: `overnight/gtm-implementation` · PR #158 (draft, kept draft).

> **Scope of this document.** This is an **architecture and readiness** spec for
> raising *controlled-live automation readiness* — i.e. how close the system is
> to being *able* to perform a tightly-gated live action under human and legal
> control. It does **not** enable live sending and is **not** an instruction to
> go live.
>
> **Actual live sends remain BLOCKED.** No live outreach, no real
> email/SMS/WhatsApp/calls/ads, no real CRM writes, no vendor API execution, no
> raw PII. Every dry-run action is `sent: false`. Every live path **fails
> closed**. Raising the readiness *score* changes documentation and gating
> design only — it does not open any send path. This document adds **no live
> code**.

---

## 1. Purpose

The Sales-Closer / GTM stack can already exercise outreach end-to-end with zero
risk of live contact (see `dry-run-channel-engine.md`). "Controlled-live" is the
*next* conceptual stage: a single, scoped, human-authorized live action against
a consenting contact, under monitoring, with a tested rollback. We are **not**
building that path here. We are raising the **readiness** to design, gate, and
review it so that — if and only if legal, client, and founder sign-off ever land
out-of-band — the remaining work is small, auditable, and fail-closed by
construction.

The deliverable is a clear target state, a state machine that terminates in
**blocked or sandbox-simulated** (never a real send), and an explicit gate
inventory mapped to the modules that already exist.

---

## 2. Readiness score

| Dimension                                 | Current | Target |
| ----------------------------------------- | ------: | -----: |
| **Controlled-live automation readiness**  |   ~40   | **80** |

- **~40 today.** The dry-run channel layer, the policy gate, the release gate,
  the permission model, and the compliance spec all exist and are tested. What
  is missing for readiness — not for *going live* — is the assembled
  authorization workflow, the connector-approval and rate-limit gates as
  first-class state, monitoring/rollback wiring, and the out-of-band sign-off
  ledger. So the *primitives* exist (~40) but the *governed path* does not.
- **80 is the target — readiness, not sending.** At 80 the system can drive a
  request all the way to a clearly-labelled, fully-gated decision and then stop:
  it either parks in `controlled_live_blocked` (a gate is unmet) or, when all
  modelled gates are satisfied in the sandbox, executes a **simulated** action
  in Tenant Zero (`sandbox_simulated`). 80 deliberately does **not** include a
  real send; the final 20 (a genuine controlled-live send) stays out of scope
  and out of code until external sign-off exists.

> The broader "Alta implementation parity" number tracked in
> `docs/cognitia/audits/alta-80-readiness-evidence.md` is a *different* axis.
> That doc explicitly holds *live automation readiness* low and unchanged; this
> doc is the design that would let that axis rise to 80 **without** unblocking a
> real send.

---

## 3. State machine

States, in order. The terminal states are `sandbox_simulated` and
`rolled_back` — there is **no terminal "sent" state**, by design.

```
                 consent + CASL/PIPEDA + approval + workspace OK
   ┌──────────┐  ───────────────────────────────────────────►  ┌────────────────────────┐
   │ dry_run  │                                                 │ ready_for_live_review  │
   └──────────┘  ◄───────────────────────────────────────────  └────────────────────────┘
        ▲             any gate fails / revoked                        │
        │                                                            │ submit for gate evaluation
        │                                                            ▼
        │                                              ┌─────────────────────────────┐
        │  remediate / re-plan                         │ controlled_live_blocked     │  ◄── default & sticky:
        └──────────────────────────────────────────────┤ (≥1 required gate unmet)    │      ALL gates must pass
                                                        └─────────────────────────────┘
                                                                     │ every modelled gate satisfied
                                                                     │ in SANDBOX (Tenant Zero only)
                                                                     ▼
                                                        ┌─────────────────────────────┐
                                                        │ controlled_live_authorized  │
                                                        └─────────────────────────────┘
                                                            │                       │
                                  sandbox execution only    │                       │  abort / monitor trip /
                                  (budget_wheels_demo)       ▼                       ▼  sign-off revoked
                                              ┌────────────────────┐        ┌──────────────┐
                                              │ sandbox_simulated  │        │ rolled_back  │
                                              │ (sent:false)       │        └──────────────┘
                                              └────────────────────┘
```

### State definitions

| State                         | Meaning                                                                                                                              | Send?       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `dry_run`                     | Default. Action is *planned only* via `planDryRunAction`; `mode:'dry_run'`, `sent:false`, `wouldSendIfLive.liveStatus:'BLOCKED'`.     | No (false)  |
| `ready_for_live_review`       | Entry gates passed (consent, CASL/PIPEDA, human approval, workspace). Action is *eligible to be reviewed* — not eligible to send.     | No          |
| `controlled_live_blocked`     | **Default sticky state once review starts.** At least one required gate is unmet. Fails closed; cannot advance.                       | No          |
| `controlled_live_authorized`  | Every modelled gate is satisfied **in the sandbox**. Authorizes a **simulated** Tenant-Zero action only. Never authorizes a real send. | No          |
| `sandbox_simulated`           | Terminal. A simulated action ran against `budget_wheels_demo` / Tenant Zero; `sent:false`, fully labelled, fully logged.              | No (false)  |
| `rolled_back`                 | Terminal. Authorization was aborted/revoked or a monitor tripped; the tested rollback path executed; state returns to safe.           | No          |

### Invariants

- **Fail-closed default.** Absent/unknown gate state is treated as *unmet*. The
  resting state of any review is `controlled_live_blocked`, mirroring
  `evaluateReleaseGate(...)` returning `passed:false` with default conditions.
- **No "sent" sink.** The graph has no edge to a real-send state. The most
  permissive terminal, `sandbox_simulated`, still yields `sent:false`.
- **`controlled_live_authorized` is sandbox-only.** It authorizes a *simulated*
  action against Tenant Zero / `budget_wheels_demo`. A real controlled-live send
  is a **separate, legally-reviewed, out-of-layer lane** (PLANNED) and is not
  reachable from this machine.
- **Reversibility.** Every forward edge has a remediation/abort edge back toward
  `dry_run` or into `rolled_back`. There is no point of no return.
- **Monotonic safety.** A revoked consent, a withdrawn sign-off, or a tripped
  monitor at any point drops the action back to `controlled_live_blocked` or
  `rolled_back`.

---

## 4. Required gates

Each gate must be satisfied to advance; **all** must hold for
`controlled_live_authorized`. Any unmet gate keeps the action in
`controlled_live_blocked` (fail closed).

| #  | Gate                          | Where it advances    | Status   | Backing primitive                                                                                            |
| -- | ----------------------------- | -------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| 1  | **Consent**                   | → ready_for_live_review | REAL  | `evaluateChannelPolicy`: requires `consent === true`. `ReleaseGate.consentVerified`.                        |
| 2  | **CASL / PIPEDA compliance**  | → ready_for_live_review | SANDBOX | Compliance spec (`docs/compliance/compliance-system-spec.md`); CASL/CRTC/PIPEDA policy + consent wording.    |
| 3  | **Human approval**            | → ready_for_live_review | REAL  | `evaluateChannelPolicy`: requires `approval === 'approved'`; `permissionModel` `approve_action`.            |
| 4  | **Workspace scope**           | → ready_for_live_review | REAL  | `evaluateChannelPolicy`: non-empty `workspaceId` (tenant isolation).                                        |
| 5  | **Connector approval**        | → controlled_live_authorized | REAL (decision) / PLANNED (connector) | `evaluateReleaseGate` `connectorApproval`; `permissionModel` `configure_live_connector` (necessary, not sufficient). |
| 6  | **Secrets configured**        | → controlled_live_authorized | SANDBOX | `evaluateReleaseGate` `secretsConfigured` (SANDBOX flag; **no secret is read**).                     |
| 7  | **Rate limits**               | → controlled_live_authorized | PLANNED | Per-tenant / per-channel throttle. Modelled as a required condition; not yet a primitive.                |
| 8  | **Monitoring**                | → controlled_live_authorized | SANDBOX | `evaluateReleaseGate` `monitoringEnabled`.                                                           |
| 9  | **Rollback ready**            | → controlled_live_authorized | SANDBOX | `evaluateReleaseGate` `rollbackReady` (also the path to `rolled_back`).                              |
| 10 | **Founder sign-off**          | → controlled_live_authorized | SANDBOX (attestation) | `evaluateReleaseGate` `founderSignoff`. Out-of-band attestation only.                   |
| 11 | **Legal / counsel sign-off**  | → controlled_live_authorized | SANDBOX (attestation) | `evaluateReleaseGate` `counselSignoff`; `ReleaseGate.legalReviewComplete`.              |
| 12 | **Client / customer sign-off**| → controlled_live_authorized | SANDBOX (attestation) | `evaluateReleaseGate` `signedCustomerScope`; `ReleaseGate.signedReleaseApproval`.       |

### Mapping to existing modules

- **Entry gates (1–4)** are enforced today by `evaluateChannelPolicy(input)` in
  `packages/agents/src/channels/channelPolicy.ts`. An `allow` there authorizes a
  **dry-run plan only** — never a send — so passing the entry gates moves a
  request to `ready_for_live_review`, not to any send.
- **Authorization gates (5–6, 8–12)** map to `evaluateReleaseGate(stage,
  conditions)` in `packages/agents/src/security/releaseGate.ts`. Its
  `controlled_live` stage already requires the full seven-condition set
  (`signedCustomerScope`, `counselSignoff`, `founderSignoff`, `monitoringEnabled`,
  `rollbackReady`, `secretsConfigured`, `connectorApproval`) and **fails closed**
  on default/empty conditions.
- **Rate limits (7)** are the one gate without a backing primitive. They are
  modelled here as a required condition so the gate inventory is complete; the
  primitive is PLANNED.
- **The impossible release token.** Independently of the readiness gates,
  `channelPolicy.ts` carries `IMPOSSIBLE_RELEASE_GATE` / `isReleaseGateOpen`: a
  gate whose required `impossibleToken` is **never constructible inside this
  layer**. Even a fully "authorized" sandbox state cannot synthesize an open
  live gate; that token must be supplied deliberately from a different,
  legally-reviewed lane. This is the type-level + runtime backstop behind "live
  remains blocked."

---

## 5. Why actual live sends remain blocked

Raising readiness to 80 does **not** add a send path. Live remains blocked by
multiple independent layers, each sufficient on its own:

1. **No live edge in the state machine.** The graph terminates in
   `sandbox_simulated` (`sent:false`) or `rolled_back`. There is no transition
   to a real-send state to reach.
2. **Planner pins `sent:false`.** `planDryRunAction` is a pure function whose
   return type fixes `mode:'dry_run'` and `sent:false` as literals — it is
   structurally incapable of emitting a sent action.
3. **`sendLive(...)` always throws.** In `dryRunChannels.ts` the live entry
   point throws `"live channels disabled"` for every channel and every input,
   regardless of any gate.
4. **`assertNoLiveSend` tripwire.** Throws `LiveSendBlockedError` on any object
   that is not `mode:'dry_run'` / `sent:false`, defending against a
   forged/tampered action.
5. **Impossible release gate.** `isReleaseGateOpen` can never return true for
   any gate this layer can construct (`IMPOSSIBLE_RELEASE_GATE`).
6. **Fail-closed authorization.** `evaluateReleaseGate` returns `passed:false`
   with default/empty conditions; unknown stages fail closed.
7. **Out-of-band human gates.** Founder, legal/counsel, and client sign-offs are
   SANDBOX attestations modelling that an external approval exists — asserting
   one here does not make it true in the real world, and a real controlled-live
   send stays PLANNED until all three land out-of-band.

**Hard safety boundaries (unchanged):** no live outreach; no real
email/SMS/WhatsApp/calls/ads; no real CRM writes; no vendor API execution; no
raw PII; Budget Wheels only as `budget_wheels_demo` / Tenant Zero sandbox;
dry-run actions always `sent:false`; live execution fails closed.

---

## 6. Path from ~40 to 80 (readiness work, not live work)

All items below are mock-safe and add **no live code**:

1. **Assemble the authorization workflow** as an explicit state machine over the
   existing pure functions (`evaluateChannelPolicy` → `evaluateReleaseGate`),
   with `controlled_live_blocked` as the sticky default.
2. **Promote connector-approval and rate-limit gates** to first-class modelled
   conditions (rate-limit primitive is PLANNED; connector approval already
   exists as a decision/permission).
3. **Sandbox-simulate** the `controlled_live_authorized → sandbox_simulated`
   edge against `budget_wheels_demo` only, emitting a labelled `sent:false`
   action through the existing dry-run planner.
4. **Sign-off ledger.** An append-only, out-of-band attestation record for
   founder / legal / client sign-offs (SANDBOX booleans; no secret read).
5. **Monitoring + rollback wiring** into the `rolled_back` edge so any trip
   reverts to a safe state.

Reaching 80 means the *governed, fail-closed, sandbox-only* path is assembled
and tested. The final step to a genuine controlled-live send — the remaining 20
— stays out of scope, out of code, and blocked until external sign-off exists.

---

## 7. Sources

- `packages/agents/src/channels/channelPolicy.ts` — entry policy gate +
  `IMPOSSIBLE_RELEASE_GATE` / `isReleaseGateOpen`.
- `packages/agents/src/channels/dryRunChannels.ts` — dry-run planner,
  `assertNoLiveSend`, fail-closed `sendLive`.
- `packages/agents/src/security/releaseGate.ts` — `evaluateReleaseGate`,
  `RELEASE_STAGES`, `ReleaseConditions`.
- `packages/agents/src/security/permissionModel.ts` — roles / capabilities.
- `docs/sales-closer/dry-run-channel-engine.md` — the dry-run safety boundary.
- `docs/security/live-release-gates.md` — release-gate + permission model.
- `docs/sales-closer-engine/compliance-layer-build-notes.md` — CASL/PIPEDA
  compliance layer.
- `docs/cognitia/audits/alta-80-readiness-evidence.md` — Alta readiness rescore
  (separate axis; live automation readiness held low).
