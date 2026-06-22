# 07 — Canonical Assembly Plan (Codex Lanes)

> **Document type:** Coordination / merge-hold map. **No feature code. No PR state changes.**
> **Authoring scope:** This document only recommends. It does **not** merge, close, retarget,
> undraft, edit, or otherwise mutate any PR. Every disposition below is a *recommendation*
> pending founder approval and a canonical runtime-lane decision.
>
> **Evidence basis:** PR inventory inspected on **2026-06-22**. Items pulled directly from the
> GitHub API (head SHA, base ref, draft flag, additions/changed-files) are tagged
> **VERIFIED as inspected on 2026-06-22**. Items taken from PR descriptions (test counts,
> "green", behavioral claims) are tagged **REPORTED as inspected on 2026-06-22** and were not
> independently re-executed at writing time. Status can drift after this timestamp; treat tags
> as "as inspected," not current absolute truth.

---

## 1. Why this document exists

A large cluster of open PRs are **parallel codex lanes building the same thing**: the
mock-safe "Sales Closer / Client Zero" GTM spine —
`lead → compliance/consent gate → human approval → mock appointment + idempotent mock CRM
writeback → proof receipt/report`. Multiple agents built overlapping versions in **different
runtimes, different paths, and against different base branches**, with no ownership manifest.

The founder needs one authoritative map: per concept, which PR is the **recommended canonical
candidate**, which are **recommended for parking**, and what is **still missing** to reach a
coherent, end-to-end assembled island. This document provides that map. It changes nothing on
its own.

---

## 2. The core problem (one sentence)

The same mock-safe Sales Closer spine has been implemented **3+ times across 2 runtimes**
(TypeScript `packages/` + `apps/web` vs Python `hermes/skills/`) and **2 base branches**
(`main` vs `claude/ep002-mission-run-pPoba`), so nothing is wired end-to-end and the
"W1 → W2 → W5" stage contracts are aspirational, not executable in one process.

### 2.1 Runtime / base split (the decisive evidence)

All rows **VERIFIED as inspected on 2026-06-22** for runtime/path/base/draft; test counts in
later sections are **REPORTED as inspected**.

| Concept | PR | Runtime / path | Base (as inspected) | Recommendation |
|---|---|---|---|---|
| W1 closer core | **#135** | TS `packages/agents/src/closer/` | `main` | **recommended canonical W1 core** |
| W1 closer core (duplicate path) | #124 | TS `packages/agents/src/closer/` (same path) | `main` | recommend park |
| W0 substrate | **#144** | TS `packages/gtm-os/` (isolated pkg) | `main` | **recommended canonical substrate candidate** |
| W2 compliance gate | #129 | **Python** `hermes/skills/w2-compliance-gate/` | `ep002` | recommend park |
| W3 CRM/appt mocks | #128 | **Python** `hermes/skills/crm-appointment-skill/` | `ep002` | recommend park |
| W4 operator console | **#138** | TS `apps/web/operator` | `main` | **recommended canonical UI candidate** |
| W5 proof report | #126 | **Python** `hermes/skills/proof-report/` | `main` | recommend park |
| W6 signal bus / ledger | #125 | **Python** `hermes/skills/signal-bus/` | `main` | recommend park |
| W7 enterprise hardening | #133 | **Python** `hermes/skills/vision-skill/` guards | `ep002` | FOUNDER-HOLD recommendation |
| Client Zero proof harness | #123 | TS **npm/node:test**, adds root `package.json` | `ep002` | FOUNDER-HOLD recommendation (root-config conflict) |
| Client Zero operator (static) | #119 | static `apps/web/operator-console/` | `ep002` | recommend park |

**Three parallel proof-receipt/ledger implementations exist** (as inspected): #144 (TS,
isolated), #123 (TS, npm/node:test), #126 (Python). The append-only hash-chained ledger
concept is *also* re-implemented in #125 and #128. This duplication is the single biggest
source of waste.

**Eight PRs target `ep002`, not `main`** (as inspected): #119, #123, #127, #128, #129, #133,
#136, #141. None can reach `main` without a retarget — a **founder base decision** (not taken
here).

---

## 3. Lane inventory (as inspected on 2026-06-22)

Test counts and "green" are **REPORTED** from PR descriptions; structural fields are
**VERIFIED**.

| PR | Title (abbrev) | Draft? | Head SHA | Adds/files | Tests (reported) | Verdict (recommendation) |
|---|---|---|---|---|---|---|
| #135 | W1 Sales Closer core (mock-safe) | draft | `7c6bbae` | 665 / 7 | 20 | recommended canonical W1 core |
| #124 | Client Zero closer core (mock-only) | draft | `0afcd74` | 908 / 9 | 13 | recommend park (duplicate of #135) |
| #144 | Proof-Governed GTM OS v0 substrate | draft | `5c2ffac` | 2992 / 39 | 53 | recommended canonical substrate candidate |
| #138 | W4 Operator Console (`/operator`) | draft | `8b4a984` | 851 / 3 | 10 | recommended canonical UI candidate |
| #140 | Proof receipt spec (`docs/architecture`) | draft | `4b4305a` | 290 / 1 | n/a (doc) | recommended receipt spec candidate |
| #127 | Proof receipt & dispute layer (doc) | draft | `46c5d7d` | 1010 / 1 | n/a (doc) | recommended docs candidate (on `ep002`) |
| #141 | Dispute Replay Pack (doc) | draft | `94bc826` | 291 / 1 | n/a (doc) | recommended docs candidate (on `ep002`) |
| #126 | W5 proof report (Python) | draft | `c03ef8c` | 919 / 6 | 19 | recommend park (duplicate proof impl) |
| #125 | W6 signal bus / ledger (Python) | draft | `98a900d` | 921 / 7 | 17 | recommend park (duplicate ledger) |
| #129 | W2 compliance gate (Python) | draft | `de0a316` | 1255 / 7 | 28 | recommend park (duplicate compliance) |
| #128 | W3 CRM/appt mocks (Python) | draft | `57910c7` | 1635 / 13 | 25 | recommend park (duplicate adapters) |
| #133 | W7 enterprise hardening (Python) | draft | `e98fe62` | 730 / 7 | (3 suites) | FOUNDER-HOLD (base `ep002` + adds CI workflow) |
| #123 | Client Zero proof harness (TS npm) | draft | `e5f3864` | 1917 / 26 | 20 | FOUNDER-HOLD (root-config conflict) |
| #119 | Client Zero operator console (static) | draft | `f1838a9` | 1063 / 7 | (smoke) | recommend park (duplicate of #138) |
| #136 | Agent Action Passport (doc) | draft | `bfc7255` | 284 / 1 | n/a (doc) | recommended docs candidate (on `ep002`) |
| #45 | Lead detail + tenant provisioning | draft | `bc9db41` | 1060 / 19 | (5+) | FOUNDER-HOLD (DB/RLS blast radius) |
| #89 | Investor audit + wedge strategy | open (non-draft) | `1e65fad` | 243 / 1 | n/a (doc) | FOUNDER-HOLD (strategic; contradicts token thesis) |

---

## 4. Required answers (recommendations only)

### 4.1 Which PR is canonical for W1?
**Recommended canonical W1 core: #135** (`feat(agents): W1 Sales Closer workflow core`).
- TS, base `main` (as inspected), injected ports
  (`CompliancePort / ApprovalPort / AppointmentPort / CrmPort / ProofPort`), reuses
  `@cognitia/core` guardrails, passes the existing closer containment guard.
- **#124** is a near-duplicate in the **identical path** `packages/agents/src/closer/`.
  **Recommend park** #124; its one distinctive idea (idempotent mock CRM) is a **candidate
  idea to salvage into** the canonical substrate (#144), which already implements it.
- Corroboration: #144's own description states "#135 stays canonical for the W1 Sales Closer
  core" (REPORTED as inspected).

### 4.2 Which PR provides proof receipts?
Distinguish **spec** from **implementation** (recommendations only):
- **Recommended receipt *spec* candidate: #140** (`docs/architecture/proof-receipt-spec.md`,
  13 required fields, redact-before-hash). Doc only.
- **Recommended receipt *implementation* candidate: #144** (`@cognitia/gtm-os`): append-only
  SHA-256 hash-chained ledger + a chained proof receipt on every transition
  (`verifyLedger()`, `verifyReceiptChain()`), PII-scanned fail-closed (REPORTED as inspected).
- **Recommended superseded by #144** (as duplicate receipt/ledger implementations):
  #123 (TS npm root), #126 (Python report), #125 (Python ledger), #128 (Python ledger).
  Their proven behaviors are **candidate ideas to salvage into** #144 — not an instruction to
  fold or close anything.
- **Recommended supporting docs candidates:** #127 (proof receipt & dispute layer), #141
  (dispute replay pack), #136 (agent action passport) — currently on `ep002`.

### 4.3 Which UI PR should become canonical?
**Recommended canonical UI candidate: #138** (W4 Operator Console at `apps/web/operator`).
- TS, base `main` (as inspected), reuses the existing `apps/web` compliance lib + fixtures,
  3 files, no new deps; route reported as building.
- **Recommend park #119** (standalone static `apps/web/operator-console/`, base `ep002`) —
  built before the real monorepo was known.
- Lead-detail console PRs (#44/#79) are a **different surface** and belong to the tenant track
  (#45), not the operator-console decision.

### 4.4 What gets parked? (recommendations)
- **Recommend park #124** — duplicate W1 core (recommended superseded by #135).
- **Recommend park #119** — duplicate operator console (recommended superseded by #138).
- **Recommend park #125, #126, #128, #129** — Python `hermes/skills` re-implementations of
  ledger / proof / CRM / compliance (recommended superseded by #144 + #135 in the TS runtime).
  Keep as reference; recommend **not** merging in parallel.
- **Recommend park #44, #79** — subsets/duplicates of the lead-detail surface in #45.
- Older overlapping audit/review/strategy docs (e.g. #110/#117/#118/#88/#107/#113) — not part
  of this spine; recommend handling as a separate docs cleanup, **not** in this assembly.

### 4.5 What gets merged only after founder approval? (FOUNDER-HOLD recommendations)
- **Base / retarget decision** for every `ep002` PR: #119, #123, #127, #128, #129, #133,
  #136, #141 — and the `ep002` vs `main` question itself.
- **#123 root-config decision** (npm-workspaces + root `package.json` / `tsconfig.base.json`
  vs the existing pnpm/vitest root) — blocks #123 and was flagged as colliding with #121.
- **Runtime-lane decision** — standardize the spine on **TypeScript (`main`, pnpm/vitest)** or
  explicitly keep a Python `hermes/skills` lane (#125/#126/#128/#129) and/or the npm-root TS
  variant (#123). *Recommendation: TypeScript.* This is a founder gate; nothing here assumes
  the outcome.
- **#45** — tenant/workspace provisioning (`COG-011 + COG-012`): real DB rows, RLS scope,
  service-role bypass path. Highest blast radius; FOUNDER-HOLD.
- **#133** (W7 hardening) — adds `.github/workflows/hardening-guards.yml` and is on `ep002`;
  FOUNDER-HOLD pending base + CI policy decision.
- **#89** — investor audit whose central finding *contradicts* the escrow/dispute/token thesis
  other docs assume; FOUNDER-HOLD (strategic, not build-critical).

### 4.6 What is still missing for 90/100?
The pieces exist but are **not assembled into one runnable island** (as inspected):
1. **No single canonical spine wired end-to-end** — #135 (closer ports), #144 (ledger +
   receipts), #138 (operator UI) are three islands that do not import each other.
2. **#135's ports are injected but unbound** — nothing implements its
   `Compliance/Approval/Appointment/Crm/Proof` ports over #144's ledger/receipt primitives,
   nor over real `agent_runs`/`approvals`/events persistence.
3. **#138 reads fixtures, not a real run** — the operator console is not driven by an actual
   workflow run + proof report/timeline.
4. **Receipt spec ≠ receipt impl** — #140's 13-field schema is not reconciled field-for-field
   with #144's emitted receipts.
5. **No persistence seam** — proof events are in-memory; the append-only events table is not
   wired.
6. **Base/root undecided** — `main` vs `ep002`; pnpm/vitest vs #123's npm root.
7. **No ownership manifest / CODEOWNERS** — #135 flagged its absence; #144 reportedly adds one
   only for `gtm-os`.
8. **Duplicate-runtime debt** — the same spine in TS and Python is itself a coherence penalty.

### 4.7 #144 status note (per founder, as inspected)
- **VERIFIED as inspected on 2026-06-22:** draft = true; head SHA `5c2ffac`; base `main`;
  39 changed files / +2992.
- **REPORTED (not re-executed at writing time):** reported green (53 tests / 15 files); the
  branch reportedly includes a `pnpm-lock.yaml` workspace-importer entry for the new
  `@cognitia/gtm-os` package. The lockfile detail is recorded **as reported** and was not
  independently re-validated here; confirm before relying on it for the root-config decision.

---

## 5. Recommended sequenced assembly order (contingent on founder approval)

This sequence is **conditional on the founder choosing the TypeScript / `main` lane**. Until
that runtime-lane and base decision is made, base/runtime remains an open decision gate and
none of the below is authorized.

1. **#135** — adopt as the W1 core (recommended first integration candidate).
2. **#144** — recommended canonical substrate candidate (ledger + receipts + idempotent mock
   adapters).
3. **Reconciliation build** — wire #135's ports onto #144's primitives (see §6).
4. **#138** — point the operator console at the real proof report/timeline instead of fixtures.
5. **#140** — reconcile the receipt spec field-for-field with the #144 implementation.
6. **Docs** — #127 / #141 / #139 / #136 after the base (`ep002` vs `main`) decision.
7. **#45** — tenant provisioning handled on a **separate** track (DB/RLS), not in this spine
   assembly.

---

## 6. Proposed next-worker prompt (NOT authorization to execute)

> **Label:** *Proposed next-worker prompt after founder approval and canonical-lane decision.*
> This is a draft brief for a future build worker. It is **not** authorized for execution and
> assumes the founder has (a) chosen the TypeScript/`main` lane and (b) approved #135 + #144
> as canonical candidates. Until then it is a proposal only.

> **Reconcile the canonical mock-safe Sales Closer spine into one TypeScript island.**
> Contingent on the TS/`main` lane being chosen; mock-only; no live integrations; no DB
> writes; no PR retargets or state changes:
> 1. Adopt **#135** (`packages/agents/src/closer`) as the W1 core. Do not create a parallel
>    core; reuse the `@cognitia/core` guardrails it already imports.
> 2. Implement #135's injected ports (`CompliancePort`, `ApprovalPort`, `AppointmentPort`,
>    `CrmPort`, `ProofPort`) as **thin adapters over the `@cognitia/gtm-os` (#144)
>    primitives**: compliance gate, mandatory human-approval queue, idempotent mock
>    appointment + CRM writeback, append-only hash-chained ledger, chained proof receipts.
> 3. Make every emitted receipt conform to the **#140** 13-field schema
>    (`receipt_id … proof_report_ref`); add a test asserting field parity.
> 4. Drive the **#138** operator console (`apps/web/operator`) from the resulting proof
>    report / operator timeline (no fixtures), keeping it read/approve-only — no send path;
>    `crm.written` stays mock.
> 5. Add **one end-to-end test**: `lead → compliance → human approval → mock appointment +
>    idempotent mock CRM → verifiable chained proof receipts` rendered in `/operator`, proving
>    no live egress, no raw PII, and no approval-to-send loophole, with a receipt on every
>    transition.
> 6. Add a `CODEOWNERS` / ownership manifest covering `packages/agents/src/closer`,
>    `packages/gtm-os`, and `apps/web/operator`.
> Out of scope: tenant provisioning/DB (#45), the Python `hermes/skills` lanes, the npm-root
> variant (#123), and anything on `ep002`.

---

## 7. Integrity statement

- This change adds **one markdown file** only:
  `docs/cognitia/audits/codex-lanes/07-canonical-assembly-plan.md`.
- **No feature code** was added or modified.
- **No PR was merged, closed, retargeted, undrafted, edited, or otherwise mutated** in the
  course of producing this document.
- Every disposition above is a **recommendation** pending founder approval and a canonical
  runtime-lane/base decision. PR facts are tagged VERIFIED or REPORTED **as inspected on
  2026-06-22** and may have drifted since.
