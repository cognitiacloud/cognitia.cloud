# SOC-Readiness & Implementation Handoff Package — Cognitia GTM Control Plane

> Date: 2026-06-10. Base: `6cde22f` (292 tests / 50 files green). Companion to
> `hardening-package-2026-06.md` (the full audit); this package is the
> **implementation-facing** cut: SOC matrix scoped to this product's controls,
> the remaining hardening gaps after HARD-4, screen/control/evidence acceptance
> criteria, the per-workflow evidence plan, the risk list, and the Codex
> handoff note.
>
> **Premise check (honesty first):** the "reconciled warm Swiss-minimal design
> system" and the visual prototype are **not in this repository** — verified by
> search: no stylesheet/token layer, no design branches on this remote; the
> operator console is functional inline-CSS. They are treated as **external
> assets in the Codex/design lanes [inferred]**. Everything else below — the
> control plane API, governance semantics, tests, and evidence machinery — is
> **[verified]** in this tree. The design direction is canonical per your
> instruction and is NOT re-explored here; the handoff note (F) tells Codex how
> to implement it against the verified control plane.
>
> Scope guard: no ecosystem integration, no token work (operating-plan §0/§0a).

---

## A. SOC-ready control matrix (product-relevant controls)

Columns as requested: objective · owner · evidence required · status · test
method. Scoped to the seven control families that matter for THIS product.
Status: ✅ implemented+tested in CI · 🟫 partial · ⛔ not yet.
(The full CC-by-CC matrix lives in `hardening-package-2026-06.md` Deliverable 4
and the re-anchored `control-matrix.md`; this is the practical cut.)

### 1. Access

| Objective                                                               | Owner        | Evidence required                                          | Status                 | Test method                                                      |
| ----------------------------------------------------------------------- | ------------ | ---------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Tenant/role from verified session only; never client headers            | ENG-platform | `serverAuth.test.ts` CI run                                | ✅                     | Forged `x-tenant-id`, no session → 401 (automated + smoke check) |
| RBAC: viewer reads; operator decides/executes/pauses; owner-only resume | ENG-platform | `killSwitch.test.ts`, `serverAuth.test.ts`                 | ✅                     | viewer mutation → 403; operator resume → 403                     |
| Tenant isolation at the data layer (RLS, non-superuser)                 | ENG-platform | `kysely.rls.pglite.test.ts` CI run; prod `app_user` config | ✅ code / 🟫 prod role | RLS suite; `select current_user` via app path                    |

### 2. Approvals

| Objective                                                                          | Owner        | Evidence required                                        | Status | Test method                                                 |
| ---------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| No side effect without explicit human approval                                     | ENG-platform | `fence.test.ts`, `lifecycle.acceptance.test.ts`          | ✅     | Execute-before-approve → 409 + `execution_denied` audit row |
| Every decision carries a closed-enum reason (training label)                       | ENG-platform | `decisionReasons.test.ts`                                | ✅     | Approve/reject/rollback without reason → 400                |
| Operator sees the exact write (preview==write) and the rationale before consenting | ENG-web      | `writePlan.test.ts` (byte-equality), `rationale.test.ts` | ✅     | Captured HTTP body equals previewed plan                    |

### 3. Audit logs

| Objective                                              | Owner        | Evidence required                                | Status                   | Test method                                               |
| ------------------------------------------------------ | ------------ | ------------------------------------------------ | ------------------------ | --------------------------------------------------------- |
| Immutable trail for every transition AND every refusal | ENG-platform | `governance.test.ts` (audit), `rollback.test.ts` | ✅                       | Denials produce `execution_denied`/`rollback_denied` rows |
| Trail is queryable and exportable for review           | ENG-platform | `GET /audit`; trust-packet export                | ✅                       | Lifecycle test asserts the 9-entry audit census           |
| No raw PII/secrets in logs                             | ENG-platform | `logging.test.ts`; live log sample               | ✅ code / 🟫 live sample | grep deployed logs for token/email → absent               |

### 4. Configuration changes

| Objective                                                            | Owner        | Evidence required                                          | Status                | Test method                                                          |
| -------------------------------------------------------------------- | ------------ | ---------------------------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| All changes via PR + CI (format/typecheck/292 tests incl. eval gate) | ENG-lead     | CI history; branch-protection export                       | ✅ CI / ⛔ protection | Direct push to base → must be blocked (**settings-blocked, gap #1**) |
| Governance config derived from code, not hand-edited                 | ENG-platform | `governance.test.ts` (derivation proven both compositions) | ✅                    | Non-v1 composition flips email-executable in test                    |
| Kill-switch flips are themselves audited config changes              | ENG-platform | `killSwitch.test.ts`                                       | ✅                    | Pause/resume → `integration_paused/resumed` audit rows               |

### 5. Vendor / integration secrets

| Objective                                                                 | Owner    | Evidence required                       | Status                         | Test method                                          |
| ------------------------------------------------------------------------- | -------- | --------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| CRM credentials encrypted at rest (AES-256-GCM), referenced never inlined | Security | `tokenProvider.test.ts`; KMS key config | ✅ code / 🟫 KMS unprovisioned | Decrypt fails without `CREDENTIAL_SECRET_KEY_BASE64` |
| Least-privilege HubSpot scopes; documented + screenshot at onboarding     | Operator | onboarding runbook §1 scope capture     | 🟫 doc'd                       | Inspect granted scopes at go-live                    |
| Vendor register current (HubSpot, hosting, KMS)                           | Security | `vendor-access-register.md` + DPAs      | 🟫                             | Quarterly review vs actual integrations              |

### 6. Incident handling

| Objective                                          | Owner        | Evidence required                                                  | Status         | Test method                                      |
| -------------------------------------------------- | ------------ | ------------------------------------------------------------------ | -------------- | ------------------------------------------------ |
| Per-tenant emergency stop, enforced in product     | ENG-platform | `killSwitch.test.ts`                                               | ✅             | Paused → execute/rollback 409, zero CRM writes   |
| Severity-classified runbook; rotation/IR linkage   | Security     | `incident-response.md`, `secret-rotation.md`; **one drill record** | 🟫 (undrilled) | Table-top a SEV-1; file the record (**gap #10**) |
| Reversible recovery for bad writes (undo, audited) | ENG-platform | `rollback.test.ts`                                                 | ✅             | Execute → undo → archived + labeled + audited    |

### 7. Monitoring

| Objective                                                | Owner        | Evidence required                          | Status                         | Test method                                  |
| -------------------------------------------------------- | ------------ | ------------------------------------------ | ------------------------------ | -------------------------------------------- |
| Health/liveness with DB probe                            | ENG-platform | `/health`; smoke check 1                   | ✅                             | DB down → 503                                |
| Post-deploy smoke catches fence drift / auth regressions | ENG-platform | `smokeDeploy.test.ts`; pipeline run output | ✅ script / 🟫 pipeline wiring | Flip email-executable → smoke FAIL, exit ≠ 0 |
| Dashboards/alerting on `*.failed.v1` + worker heartbeat  | ENG-platform | dashboards config                          | ⛔ (OBS-1)                     | Kill worker → alert fires                    |

---

## B. Remaining hardening gaps (post-HARD-4, prioritized)

Only gaps that matter for an enterprise control plane; feature sprawl excluded.
Numbers continue the hardening-package list (gap #8 is **closed**).

| Pri | Gap                                                                                                                                                                                                                          | Class           | Why it matters here                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Branch protection + required checks OFF (gap #1)                                                                                                                                                                             | settings        | Config-change control (A.4) is incomplete without it; one click                                                                                                                                                                                                                               |
| 2   | Deploy-time identity unproven: `app_user`/KMS/TLS/backups (gap #2)                                                                                                                                                           | infra           | Converts four 🟫 rows above to ✅ with evidence                                                                                                                                                                                                                                               |
| 3   | UI implementation against the canonical design system (Deliverable-1 fixes 1–6 in the hardening package: tabs/routes, per-panel loading/empty/error, term tooltips, session-expiry, shared styles, confirm on Execute/Pause) | product (Codex) | The control plane's trust is backend-proven; the **operator-facing presentation** is the remaining trust gap. "Clean, premium, not text-heavy" maps to: split surfaces, progressive disclosure (expanders already exist — keep), counts-not-paragraphs, definitions on hover not inline prose |
| 4   | CI security steps: dependency scan + SAST + coverage floor (gaps #4/#5)                                                                                                                                                      | code            | Vulnerability-management control family is empty without it                                                                                                                                                                                                                                   |
| 5   | Live round-trip + first real evidence capture (gap #3)                                                                                                                                                                       | credentials     | Layer-3 verification; unlocks the SOC point-in-time set                                                                                                                                                                                                                                       |
| 6   | Retention/offboarding policy + deletion path (gap #7)                                                                                                                                                                        | policy+code     | Confidentiality C1.2 is ⛔                                                                                                                                                                                                                                                                    |
| 7   | One IR table-top + one restore drill, records filed (gap #10)                                                                                                                                                                | process         | Incident family is "runbook-only" until drilled                                                                                                                                                                                                                                               |

**Explicitly not gaps (do not build):** more channels, enrichment, voice,
ecosystem connectors, token work, decorative trust pages.

---

## C. Acceptance criteria for "ready for Codex implementation"

**Screen-level** (each of the six surfaces: Queue · Runs · Reporting ·
Governance · Audit · Integration):

- [ ] Renders as its own route/view against the existing endpoints (`/agent-actions`, `/agent-runs`, `/metrics/scorecards` + `/metrics/trust`, `/governance`, `/audit`, `/integrations/*`) with **no API changes required** — the contract is frozen and test-covered.
- [ ] Has explicit loading, empty (with one-line guidance), and error states; a failed fetch is visible, never silent.
- [ ] Destructive controls (Execute, Pause, Undo) keep their gating semantics exactly (disabled-until-allowed; mandatory-reason panel; owner-only resume) — these are test-enforced server-side and must not be softened client-side.
- [ ] Governance vocabulary (`fully_reviewed`, `stale_since_proposal`, `✓ trusted`, idempotent replay) gets hover/aria definitions, not inline paragraphs (premium, not text-heavy).
- [ ] Visual: canonical design system tokens only; no ad-hoc inline CSS.

**Control-level:**

- [ ] All 292 existing tests stay green — the suite IS the control contract; any UI change that breaks `fence`/`killSwitch`/`lifecycle.acceptance` is a rejected change, not a test to update.
- [ ] The preview shown to the operator continues to come from `GET /agent-actions/:id/preview` (never recomputed client-side), preserving preview==write.
- [ ] Reason codes remain closed enums sourced from the client constants; free-text only in `note`.
- [ ] Kill-switch halted state is visible on every screen that can trigger execution (banner or equivalent), not only on Integration.

**Evidence-level:**

- [ ] "Export trust packet" and "Export regression" remain one-click and produce the unmodified server JSON.
- [ ] Every operator decision made through the new UI produces the same audit rows as the current UI (verify via `GET /audit` census after a scripted walkthrough).
- [ ] A screenshot set of the six screens (loaded + empty + error states) is archived as the design-implementation evidence artifact.

---

## D. Audit & evidence plan (per major workflow test)

After each workflow test, these artifacts must exist; archive them under a
dated folder (and later in the compliance tool) for SOC review.

| Workflow test           | Evidence that must exist after it                                                                                                                                                                   | Archive artifact                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Deploy                  | Smoke output (all PASS/WARN lines + exit 0); `/health` 200                                                                                                                                          | smoke stdout capture; deploy id + commit SHA                                                |
| Readiness               | `GET /integrations/readiness` → READY (or named missing properties)                                                                                                                                 | JSON response capture                                                                       |
| Preflight               | Report with `writes_performed: 0` + proposal list; ledger count unchanged                                                                                                                           | report JSON                                                                                 |
| Propose→approve→execute | `proposed`/`approved`/`executed` audit rows; decision label with reason; exactly one CRM object with `cognitia_*` properties; idempotent re-execute (no second object)                              | `GET /audit` export; CRM object screenshot; decision via `GET /agent-actions/:id/decisions` |
| Denial paths            | `execution_denied` (pre-approval) and `rollback_denied` (halted) rows with reasons                                                                                                                  | audit export slice                                                                          |
| Kill switch             | `integration_paused`/`integration_resumed` rows with actor; halted execute → 409, zero writes                                                                                                       | audit export + 409 response capture                                                         |
| Undo                    | `rolled_back` label + event + audit; archived CRM object                                                                                                                                            | audit export; CRM recycle-bin screenshot                                                    |
| Reporting               | Scorecards + run rollups consistent with the ledger counts above                                                                                                                                    | `/metrics/scorecards`, `/agent-runs` JSON                                                   |
| **Capstone**            | One exported **trust packet** — it embeds metrics, scorecards, decisions, the full audit trail, governance matrix, kill-switch state, 15 CI-pointed control attestations, and a fresh eval-gate run | the packet JSON (this is the primary SOC point-in-time artifact)                            |

CI evidence (continuous, already wired): every build's 292-test run including
the golden eval gate, lifecycle acceptance, and the README/attestation
pointer guards. Capture: CI run links per release.

---

## E. Risk list (highest-risk remaining assumptions)

**Verified (safe to rely on):**

- Approval gating, audited denials, preview==write, idempotency, undo,
  kill-switch enforcement, tenant isolation (incl. real Postgres), no-PII
  logging — all CI-enforced at `6cde22f`.
- The API contract the UI needs is complete and test-covered; Codex needs no
  backend changes for the six screens.

**Inferred (probably true, not proven in this tree):**

- The reconciled design system exists and is implementable as described
  (external lane; not in this repo).
- Codex's audit lanes will not change the API contract (if they do, the
  screen-level criteria above must be re-baselined).
- `SET LOCAL` tenant scoping behaves under pgBouncer as it does in PGlite (R-2).

**Not yet proven (treat as open risk until evidenced):**

- Production identity: deploy actually runs as `app_user` with KMS key, TLS,
  backups (currently unprovisioned).
- The live HubSpot round-trip (no real CRM write has ever occurred).
- Incident response under pressure (runbook exists; never drilled).
- The UI under real operator load (error/empty states currently absent).
- Branch protection (a direct push to base would succeed today).

---

## F. Handoff note for Codex

**What you are implementing:** the six operator surfaces (Queue · Runs ·
Reporting · Governance · Audit · Integration) in the canonical design system,
against a **frozen, fully test-covered API** at base `6cde22f`. Do not change
the backend; everything you need exists and is documented in the README
capability table (each endpoint ↔ its proving test).

**Source of truth for behavior:** `apps/web/src/app/approvals/page.tsx` is the
working reference implementation of every interaction (reason panel, preview
expander, why expander, preflight, readiness, pause/resume, exports). Treat it
as a functional spec to be re-skinned and split — not as visual precedent.

**Hard rules (server-enforced; do not soften client-side):**

1. Execute/Undo/Pause stay gated exactly as the reference (disabled-until-
   allowed; mandatory closed-enum reason; owner-only resume).
2. Preview content comes only from `GET /agent-actions/:id/preview`.
3. Halted (kill-switch) state must be visible wherever execution can be
   triggered.
4. Exports return the server JSON unmodified.

**Definition of done:** Section C checks all green; the 292-test suite
untouched and green; the screenshot evidence set archived; a scripted
walkthrough produces the same audit census as the reference UI.

**Sequencing:** Queue first (it embeds preview/why/reason — the trust core),
then Runs, then Integration (readiness + kill switch), then Reporting,
Governance, Audit. Land per-screen PRs; each must keep CI green.
