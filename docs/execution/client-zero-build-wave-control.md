# Client Zero — Sales Closer Build Wave **Control**

**Doc type:** Build-wave control charter (coordination only — **NOT a build session**, no product code).
**Owner:** Worker 0 / Controller
**Compiled:** 2026-06-21
**Branch (this doc):** `claude/client-zero-build-control-3f10l9`
**`main` HEAD at compile:** `d3d198e` (the #96 compliance-layer-scaffold merge).
**Repo:** `cognitiacloud/cognitia.cloud`

This is the **control companion** to `docs/execution/client-zero-build-coordination.md`
(the activation plan for the next wave). The coordination doc ratifies the **5-worker**
spine (W1–W5 + W0); this charter **adds two cross-cutting lanes — W6 Signal Bus / Action
Ledger and W7 Enterprise Hardening — without renumbering or re-scoping W1–W5**, and
restates the control surface (legend, repo facts, ownership, contracts, build order,
acceptance, gates, guardrails) for the full **7-worker** wave. Where this charter and the
coordination doc overlap on W1–W5, the coordination doc is authoritative; this charter
defers to it and never contradicts it.

It does **not** modify product code. The only file in this diff is
`docs/execution/client-zero-build-wave-control.md`.

---

## 1. Status legend

| Tag             | Meaning                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **VERIFIED**    | Confirmed by direct inspection of `main` (`d3d198e`) on 2026-06-21.                                                                             |
| **INFERRED**    | Derived from companion docs (coordination / compliance / event-taxonomy / integration / security) read-through, not directly re-confirmed here. |
| **RECOMMENDED** | Controller proposal for files/contracts that **do not exist yet** and a worker must create. Paths are targets, not existing code.               |
| **BLOCKED**     | Out of scope / forbidden for this wave. Requires explicit manager approval to change.                                                           |

---

## 2. Strategic frame `INFERRED`

| Name              | Role                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| **Cognitia**      | Trust / control / proof plane — "is this safe, approved, and provable?" NOT a video/avatar product.           |
| **Demandara**     | GTM / operator brand.                                                                                         |
| **Sales Closer**  | Demandara workflow / product — the lead→booking spine of this wave.                                           |
| **Client Zero**   | First customer: a dealership / "Auto Growth OS" deployment.                                                   |
| **Hermes Vision** | Supporting publish-safety / media-QC artifact only (`hermes/skills/vision-skill`). NOT the Cognitia identity. |

**Scope guards (INFERRED, inherited from the coordination doc & WORKER-OWNERSHIP):**

- **MoverOS is NOT Client Zero.** No moving-vertical surfaces here.
- **Alta parity is roadmap only** — we build the proof-first vertical GTM spine that _later_
  supports Katie/Alex/Luna-class capabilities; we are **not** cloning Alta now.
- **Parked stays parked:** Agent-Economy, token-lab, crypto-visibility get **no worker**.
- **#99 Apify stays QUEUED** — this wave runs on **synthetic fixtures only**.
- Cognitia is not redefined as video/avatar; Hermes Vision stays a supporting artifact.

---

## 3. Current repo facts `VERIFIED` (on `main` `d3d198e`)

- The repo is a **TypeScript / pnpm monorepo** — `apps/{api,web,worker}`,
  `packages/{core,db,agents,integrations,evals,workflows}`, `hermes/`, `docs/`,
  `scripts/`, `.github/`, `pnpm-workspace.yaml`, `vitest.config.ts`. (Not Python; not
  greenfield.)
- **Closer data layer is landed:** `packages/core/src/schemas/closer.ts` (Phase-1:
  sources, briefs, claims, scoring), `packages/core/src/schemas/trust.ts`
  (`evidenceTag`, `closerClaim`), and the schema **barrel**
  `packages/core/src/schemas/index.ts` exporting exactly
  `common · event · agent · trust · economy · closer` (6 lines).
- **Compliance + event + integration + security specs exist** under `docs/`:
  `docs/compliance/compliance-system-spec.md`, `docs/event-taxonomy.md`,
  `docs/integration-contracts.md`, `docs/security-and-compliance.md`,
  `docs/data-model.md`, `docs/agent-contracts.md`.
- **Not yet on `main` (to be built this wave):** `apps/api/src/closer/**` runtime; the four
  per-worker schemas `closerLead.ts`, `complianceLog.ts`, `closerAppointment.ts`,
  `closerProof.ts`; any closer-spine signal/ledger projection; closer-lane CI guards.
- **`docs/execution/` does not exist on `main`** — this doc creates it. The coordination
  doc and its companions (`WORKER-OWNERSHIP.md`, `BOARD.md`) currently live on in-flight
  branches, not yet merged to `main`.

> Note: a single-commit `hermes`-only clone can make the repo look greenfield. It is not —
> the spine work lives on `main` and the `claude/cz-w1…w5` / coordination feature branches.

---

## 4. Companion documents (control reads these; do not duplicate them)

| Doc                                                | Status                      | What it owns                                                                                                  |
| -------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `docs/execution/client-zero-build-coordination.md` | INFERRED (in-flight branch) | Authoritative W1–W5 activation plan, ownership, reuse contracts, conflicts, integration order, branch naming. |
| `docs/execution/WORKER-OWNERSHIP.md`               | INFERRED (companion)        | Lane boundaries, new-file ownership principle, parked lanes.                                                  |
| `docs/execution/BOARD.md`                          | INFERRED (companion)        | Current wave = review-only; §5 blockers (B2–B5), §8 review-gate.                                              |
| `docs/compliance/compliance-system-spec.md`        | VERIFIED (on main)          | `consent_basis`, append-only `compliance_log`, Gate A, channel rules.                                         |
| `docs/event-taxonomy.md`                           | VERIFIED (on main)          | `domain.entity.action.vN`, required event fields, immutability.                                               |
| `docs/integration-contracts.md`                    | VERIFIED (on main)          | Adapter principles, idempotency, mock-vs-live boundary.                                                       |
| `docs/security-and-compliance.md`                  | VERIFIED (on main)          | RLS/tenant isolation, no-PII-in-logs, ActionLedger audit trail, approval defaults.                            |

This charter adds **W6** and **W7** on top of these and re-states control for all 7 lanes.

---

## 5. The spine `INFERRED`

```
 lead in ─▶ consent / compliance gate ─▶ human approval ─▶ booking + mock CRM writeback ─▶ proof report
   W1            W2  (Gate A)               W3 (Gate B)            W4 (mock only)               W5

 W6 Signal Bus / Action Ledger  — every stage transition emits an immutable event + ledger entry (audit substrate).
 W7 Enterprise Hardening        — cross-cutting: tenant RLS, log redaction, secrets, CI guards (active throughout).
```

---

## 6. Worker file ownership (7 lanes)

**Principle (inherited):** the merged spine is **read-only to all workers**; extend only via
**new files**; one worker owns one path prefix; **no two workers write the same file**;
cross-cutting changes route through **W0**. A worker is "done" only when its diff is confined
to its prefix and the full guard/doctrine suite (PII, source-risk, evidence, Phase-1
containment) is green.

### 6.1 W1–W5 — as ratified in the coordination doc `RECOMMENDED` (new files; W1–W5 paths reproduced for control)

| Worker | Stage                        | Writes ONLY (new files/prefixes)                                                                                                                              | Must NOT touch                                                                            |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **W1** | Lead intake                  | `packages/core/src/schemas/closerLead.ts`; `apps/api/src/closer/intake/**`; synthetic fixtures `apps/api/src/closer/intake/__fixtures__/leads.synthetic.json` | `closer.ts`, `types/index.ts` unions, migrations `0020/0021`                              |
| **W2** | Consent / compliance gate    | `packages/core/src/schemas/complianceLog.ts`; `apps/api/src/closer/compliance/**`                                                                             | `apps/web/src/lib/complianceTypes.ts`, core unions, `closer.ts`                           |
| **W3** | Human approval               | `apps/api/src/closer/approval/**`; `apps/web/src/app/(closer)/approvals/**` (new route group)                                                                 | W2 files; existing `apps/web/src/app/approvals/**`; existing `apps/api/src/crm*.ts`       |
| **W4** | Booking + mock CRM writeback | `packages/core/src/schemas/closerAppointment.ts`; `apps/api/src/closer/booking/**`; `apps/api/src/closer/crm/mockWriteback.ts`                                | live HubSpot creds/path; existing `crmNote.ts`/`crmExecute.ts`; W3 files                  |
| **W5** | Proof report                 | `packages/core/src/schemas/closerProof.ts`; `apps/api/src/closer/proof/**`; `apps/web/src/app/(closer)/proof/**` (new route group)                            | finance/trade-in autonomy (handoff only, per #106); existing `apps/web/src/app/proofs/**` |

### 6.2 W6 — Signal Bus / Action Ledger `RECOMMENDED` (new lane this charter adds)

W6 is the **audit/observability substrate** for the closer spine. It **reuses** the landed
immutable `events` (`packages/core/src/events`), the `agent_actions`/**ActionLedger** trail,
and append-only `audit_events`. It **adds only closer-scoped projection** and **must not
mutate** any landed event schema, `ActionLedger`, or migration.

| Writes ONLY (new files/prefixes)                                                                                                                                                                                                                                                  | Must NOT touch                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/schemas/closerSignal.ts` (closer-spine event payloads + ledger read-model, registered under the existing taxonomy); `apps/api/src/closer/signal/**` (in-process bus that fans stage transitions into `events`; append-only ledger read-model that W5 consumes) | landed `packages/core/src/events/**`; existing `ActionLedger`/`agent_actions`; `audit_events`; any landed migration or `closer.ts` |

**Contract:** every closer stage transition (W1→W5) is emitted through W6 as an immutable
event named per `domain.entity.action.vN` (e.g. `signal.closer.*.v1`), carrying the required
fields (`tenant_id`, `event_name`, `entity_ref`, `occurred_at`, `trace_id`, **no raw PII —
refs/hashes only**). Corrections are new events, never edits. W5's proof report reads the
W6 ledger read-model; it never re-runs stages.

### 6.3 W7 — Enterprise Hardening `RECOMMENDED` (new lane this charter adds)

W7 is the **cross-cutting hardening + CI guard** lane. It **reuses** landed invariants — RLS
`withTenant`/`SET LOCAL` (`packages/db/src/client.ts`), the log-redaction helper
(`packages/core`), `SecretStore`/`ConnectionTokenProvider`, webhook signature verification,
and the `repository.contract` suite — and **adds only closer-scoped verification + guards**.
It **must not fork or edit** landed RLS, redaction, or secrets code.

| Writes ONLY (new files/prefixes)                                                                                                                                                                                                                                         | Must NOT touch                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/closer-guards.yml` (closer-lane CI); `scripts/closer/**` (banned-term scan, live-adapter scan, fixture-PII scan, path-confinement check); new closer-scoped tests `packages/db/src/closer/*.rls.test.ts` and `apps/api/src/closer/**/*.guard.test.ts` | landed `packages/db/src/client.ts` RLS; landed redaction helper; `SecretStore`; existing `.github/workflows/*` (extend via new workflow, do not rewrite) |

### 6.4 The one shared file — controller-mediated `RECOMMENDED`

The barrel `packages/core/src/schemas/index.ts` (currently 6 exports) must re-export the new
schema modules. To avoid a five-way collision, **W0 alone** appends exports, in landing
order: `closerLead → complianceLog → closerAppointment → closerProof → closerSignal`.
Workers never edit the barrel directly.

### 6.5 Collision matrix — who may write what

| Path prefix                                                                                                                             | Writer               | Everyone else          |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------- |
| `apps/api/src/closer/intake/**`, `schemas/closerLead.ts`                                                                                | W1                   | read-only              |
| `apps/api/src/closer/compliance/**`, `schemas/complianceLog.ts`                                                                         | W2                   | read-only              |
| `apps/api/src/closer/approval/**`, `apps/web/src/app/(closer)/approvals/**`                                                             | W3                   | read-only              |
| `apps/api/src/closer/booking/**`, `closer/crm/mockWriteback.ts`, `schemas/closerAppointment.ts`                                         | W4                   | read-only              |
| `apps/api/src/closer/proof/**`, `apps/web/src/app/(closer)/proof/**`, `schemas/closerProof.ts`                                          | W5                   | read-only              |
| `apps/api/src/closer/signal/**`, `schemas/closerSignal.ts`                                                                              | W6                   | read-only              |
| `.github/workflows/closer-guards.yml`, `scripts/closer/**`, closer `*.rls.test.ts`/`*.guard.test.ts`                                    | W7                   | read-only              |
| `packages/core/src/schemas/index.ts` (barrel)                                                                                           | **W0 only**          | propose via PR comment |
| **Landed spine** (`closer.ts`, `types/index.ts`, `events/**`, `ActionLedger`, `crmNote.ts`/`crmExecute.ts`, RLS, redaction, migrations) | **nobody**           | reuse by import only   |
| `hermes/**`                                                                                                                             | **nobody this wave** | reference only         |

---

## 7. Integration contracts between workers `RECOMMENDED`

Data flows one direction; each consumer depends on the **contract shape**, never another
worker's internal modules. Reuse landed primitives (do not re-implement).

| Contract                                                   | Producer → Consumer  | Basis / reuse                                                                                                                                                                   |
| ---------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normalized lead (PII-safe)                                 | W1 → W2              | reuse `normalizeGtmProspect`, `GtmProspect`, `closerSourceCreate`/`closerSourceRisk`; raw email/phone transit `RawGtmProspectInput` only, hashed/masked, **never persisted**.   |
| **Gate A** consent decision → append-only `compliance_log` | W2 → W3, W6          | reuse `canContactProspect`, `ConsentStatus`/`ContactBasis`; W2 owns the deterministic **adapter map** between spec `consent_basis` and core `ConsentStatus` (rewrites neither). |
| **Gate B** human approval                                  | W3 → W4              | reuse `ApprovalStatus`/`agent_actions`/`/approvals` (#93), operator queue (#78); a human promotes draft → approved; nothing proceeds autonomously.                              |
| Booking + **mock** CRM writeback result                    | W4 → W5, W6          | reuse meeting-skill (#75), HubSpot adapter **interface** (#77) but **mock-backed** (`crm/mockWriteback.ts`); `EventDomain` (`crm`/`calendar`). **Never a live vendor.**         |
| Evidence-tagged proof record                               | W5 (reads W6 ledger) | `verified_fact` ⇒ requires `evidence_ref` (no fabricated facts); redaction scanner (#33); Hermes `vision_privacy_scan` for any proof asset's publish-safety.                    |
| Closer-spine events + ledger read-model                    | W6 ↔ all stages      | reuse immutable `events` + ActionLedger + `audit_events`; emit per `domain.entity.action.vN`, refs/hashes only.                                                                 |
| Cross-cutting guards/invariants                            | W7 → all             | reuse RLS `withTenant`, redaction helper, `SecretStore`, signature verification; enforce via closer-lane CI.                                                                    |

---

## 8. Build order `RECOMMENDED`

Mirrors the coordination doc's data-flow order, with the two new lanes slotted in. **Each
step lands only on green guard/doctrine CI**, and **only after** the coordination doc's
posture gates (a) review-gate clear, (b) named legal/compliance sign-off owner (B3),
(c) canonical lead-detail lane ratified (B4/T4), (d) explicit manager "go".

0. **W7 (guard scaffold) + W6 (substrate)** land first as foundation: W7 stands up the
   closer-lane CI guards (so every later PR is checked); W6 registers the closer event
   schemas + ledger read-model (reusing landed `events`/ActionLedger) so W1–W5 can emit.
1. **W1** lead intake (schemas + synthetic fixtures).
2. **W2** consent/compliance gate (Gate A → `compliance_log`).
3. **W3** human approval (Gate B).
4. **W4** booking + **mock** CRM writeback (runs only on W3-approved items).
5. **W5** proof report (evidence-tagged, redaction-scanned; reads W6 ledger).
6. **W7 hardening pass** — closer-scoped RLS/guard tests tightened across the assembled spine.
7. **W0 integration** — append the five new modules to the barrel in landing order, run the
   full guard suite, open the `claude/cz-wave-integration` draft PR.

---

## 9. Acceptance criteria `RECOMMENDED`

**Per worker (all must hold):** diff confined to the worker's prefix (§6); depends on others
only via contracts (§7) + the W6 bus; **synthetic fixtures only**, no raw PII, no live egress;
worker-scoped tests run offline and green.

| Worker | Stage-specific acceptance                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| W1     | Synthetic lead normalized PII-safe (hash/mask/domain only); raw contact never persisted.                                                     |
| W2     | Deterministic Gate-A decision for fixtures; every decision written to append-only `compliance_log`; SMS/WhatsApp/AI-voice blocked at launch. |
| W3     | Human promotes a draft to approved (Gate B) with rationale-at-approval-time; nothing autonomous.                                             |
| W4     | Booking + CRM writeback produce **mock** records; **zero** live HubSpot/calendar/vendor calls.                                               |
| W5     | Proof record reconstructable solely from the W6 ledger + artifacts; every `verified_fact` carries an `evidence_ref`.                         |
| W6     | Each stage transition → exactly one immutable event + ledger entry; order preserved; refs/hashes only.                                       |
| W7     | Closer-lane CI guards active and green; closer RLS/tenant isolation tests pass; no banned term / live adapter / fixture PII can merge.       |

**End-to-end (wave exit):** one synthetic lead flows **lead in → Gate A → Gate B → mock
booking + mock CRM write → proof report**, every transition recorded in the append-only
ledger, **zero network egress**, fixtures only.

---

## 10. Merge / review gates `BLOCKED` without explicit manager approval

- **All PRs DRAFT, base `main`, each confined to its worker's path prefix.**
- **No PR-state actions by anyone (controller or worker): no merge, undraft, close, retarget,
  archive, or delete.** Hard rule — applies to every lane incl. W0.
- **Controller (W0) review required** for the barrel edit (§6.4) and any cross-cutting change.
- A worker is review-eligible only when: (1) diff confined to its prefix; (2) **synthetic
  fixtures only**, no raw PII, `.example` emails / `555-01xx` phones; (3) **no live surface**
  (§11), proven by W7's CI guards.
- Any landed-spine, parked-lane (§11), or `hermes/**` edit appearing in a diff is an
  **automatic review block**.

---

## 11. No-live-surface guardrails `BLOCKED`

**Forbidden in this wave** (presence in any diff blocks the PR; escalate to manager):

- Live outreach of any kind: **SMS, calls, WhatsApp, LinkedIn automation, ads, vendor calls.**
- **Real prospect data, real CRM writes, real/live appointment booking.** CRM writeback is
  **mock-only**.
- **Raw PII.** Fixtures use fake `.example` emails and `555-01xx` phones; hash/mask/domain
  only (per `@cognitia/core` PII doctrine; **no raw PII in `events`/logs** — refs/hashes only).
- **Public token / coin / liquidity / presale / airdrop / yield / investment** language
  anywhere (code, comments, docs, fixtures).
- Redefining **Cognitia as video/avatar.**
- **Parked lanes:** Agent-Economy, token-lab, crypto-visibility. **#99 Apify stays QUEUED**;
  ingestion is **synthetic fixtures only**.

**Mandated posture:**

- All integrations sit behind a **mock / DRY-RUN boundary with no network egress.** Per
  `docs/integration-contracts.md`, adapters never decide policy and refuse to act on an
  unapproved action; in this wave the live path is **not exercised** — W4 is mock-backed.
- **W7 CI guard (`scripts/closer/**`+`.github/workflows/closer-guards.yml`):** fail the
build on a live adapter import, a banned term, a non-`.example` email / non-`555-01xx`
  phone in fixtures, raw PII in a payload/log, or a diff escaping its worker prefix.
- **Landed security invariants apply** (`docs/security-and-compliance.md`): tenant RLS
  (`SET LOCAL`), no-PII-in-logs redaction, ActionLedger audit trail, human-approval default
  for any side effect, idempotent writes, secrets via `SecretStore` only.

**In-repo precedent inherited (`VERIFIED`):** the Hermes vision skill encodes a conservative
posture we adopt as baseline — `skill.yaml` constraints `read_only` / `no_delete` / `no_post`
/ `redact_logs`, and `vision_privacy_scan` (`hermes/skills/vision-skill/vision_skill.py`) as a
publish-safety gate (scan → `publish_safe` → block/remediate) reused by W5 for proof assets.
This is **content-publish safety, NOT** the W2 lead-consent/Gate-A gate; Hermes Vision remains
a supporting artifact and is **frozen** for this wave.

---

## 12. Controller change log

| Date       | Author          | Change                                                                                                                                                                                                                                                                                                                                              |
| ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-21 | W0 / Controller | Initial build-wave **control** charter. Reaffirms ratified W1–W5 ownership (deferring to `client-zero-build-coordination.md`); **adds W6 Signal Bus/Action Ledger and W7 Enterprise Hardening** as new cross-cutting lanes (additive, no renumber). Authored on a `main`-based branch (`d3d198e`). Docs-only; no product code; no PR-state changes. |
