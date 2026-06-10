# Product-Hardening Package (pre-expansion)

> Date: 2026-06-10. Base commit: `cb95fba`. Author: hardening review.
> Purpose: the package required **before** broader feature expansion — make the
> core look serious, prove it works, generate audit evidence, get SOC-ready.
> Scope guard: no ecosystem/multichannel/token work (operating-plan §0/§0a).
>
> **Evidence labels, used on every material claim:**
> **[V] verified** — confirmed in code/tests/CI this review;
> **[I] inferred** — likely true, not directly confirmed;
> **[R] recommended** — not yet true; an action.
>
> Companion (older, anchored to stale `ea7677e`, partly superseded here):
> `control-matrix.md`, `risk-register.md`, `evidence-checklist.md`. Where they
> conflict with this document, **this document is current** (it reflects
> GOV-1…RUN-1 merged this session). The most important correction: auth is now
> **session-derived** (`HmacSessionVerifier`), not header-trusted — the old
> matrix row "AC-2 ⛔ header-trust today" is **out of date**.

---

## 0. Verified current-state baseline (what the package builds on)

All **[V]** unless noted, confirmed at `cb95fba`:

- **292 tests / 50 files green**; CI gate (`.github/workflows/ci.yml`) runs
  `format:check` + `typecheck` + full `vitest` on every push and PR.
- **Auth is session-derived**: tenant + role come from a verified principal
  (`apps/api/src/auth.ts` `HmacSessionVerifier`); a client `x-tenant-id` header
  is not trusted; fail-closed without `SESSION_SECRET`.
- **Tenant isolation** proven on real Postgres under a non-superuser role
  (`packages/db/src/kysely.rls.pglite.test.ts`).
- **Governed write lifecycle**, each stage test-enforced: preflight (zero-write)
  → preview (byte-equal to write) → approval (mandatory reason) → idempotent,
  provenance-stamped execution → reversible undo → audited denials.
- **Enforced kill switch** (`killSwitch.test.ts`), **code-derived governance
  matrix** + **queryable audit trail** (`governance.test.ts`), **exportable
  trust packet** with a re-run eval gate and CI-evidence-pointed attestations
  (`trustPacket.test.ts`), **per-segment scorecards** (`scorecards.test.ts`),
  **run/plan review** (`runPlans.test.ts`).
- **Two governed CRM action types** (task + grounded note), both through the
  full lifecycle (`crmNote.test.ts`).
- **Deploy smoke** that fails on fence drift / auth regressions
  (`smokeDeploy.test.ts`); **readiness gate** before first live write
  (`readiness.test.ts`).
- **No-PII-in-logs** invariant with tests (`logging.test.ts`,
  `docs/security-and-compliance.md`).

**Known non-code blockers (not maturity, just sequencing):**

- **Settings-blocked:** GitHub branch protection + required checks + auto-merge.
- **Credentials-blocked:** live HubSpot token + portal properties + KMS data key.
- **Infra-blocked:** `app_user` DB role, TLS, backups/PITR, pgBouncer validation.
- **Data-blocked:** earned-autonomy activation (needs real decision volume).

---

# Deliverable 1 — UI hardening review

Surface audited: the single operator console (`apps/web/src/app/approvals/page.tsx`)
and its client (`apps/web/src/lib/apiClient.ts`). Verdict per dimension, then a
ranked fix list. The console is functionally rich but **alpha-grade in presentation
and resilience**; nothing here weakens governance, but several items would
embarrass a serious demo or confuse an operator under load.

| Dimension                                     | State                                                                                                                                                                        | Evidence                                       | Verdict                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Trustworthiness (does the UI tell the truth?) | Strong — every destructive control is gated; preview shows the byte-exact write; denials surfaced as 401/403/409 not swallowed                                               | `page.tsx` explainError; preview panel **[V]** | Keep                                               |
| Workflow clarity                              | Mixed — one long page with ~10 toggled panels (queue, preview, why, preflight, readiness, governance, audit, scorecards, runs, kill switch); no information hierarchy or nav | `page.tsx` single component **[V]**            | Harden                                             |
| Approval safety                               | Strong — execute disabled until approved; mandatory reason panel; kill-switch banner; owner-only resume                                                                      | `page.tsx`, `killSwitch.test.ts` **[V]**       | Keep                                               |
| Operator comprehension                        | Mixed — rich data, but no empty-state guidance on first load, no inline definitions (what is "fully_reviewed"? "stale_since_proposal"?)                                      | `page.tsx` **[V]**                             | Harden                                             |
| Auth/session UX                               | Weak — operator pastes a raw session token into a textbox; no expiry indication; token in `sessionStorage`                                                                   | `page.tsx` sign-in **[V]**                     | Harden (real SSO is the fix; interim: expiry hint) |
| Error/loading resilience                      | Mixed — global `busy` flag; best-effort metrics/integration calls swallow errors silently (`catch {}`); no per-panel loading/empty/error states                              | `page.tsx` refresh() **[V]**                   | Harden                                             |
| Accessibility                                 | Unverified — inline styles, some `aria-label` on checkboxes only; no audit done                                                                                              | `page.tsx` **[I]**                             | Assess                                             |
| Visual seriousness vs Alta                    | Weak — unstyled inline-CSS tables, no design system, no brand; reads as an internal tool, not a product                                                                      | `page.tsx` **[V]**                             | Harden (cosmetic but real for "seriousness")       |

**Ranked UI fixes (hardening, not features):**

1. **[R] Split the monolith into tabs/routes** (Queue · Runs · Reporting · Governance · Audit · Integration). One 1,100-line component is a maintainability and comprehension risk. _Proof of done:_ each surface is its own route/component; queue page renders without loading the others.
2. **[R] Per-panel loading / empty / error states.** Today a failed metrics call disappears silently and a fresh tenant shows blank tables. _Proof:_ every panel renders a labeled empty state and a visible error on fetch failure.
3. **[R] Inline definitions / tooltips** for governance terms (`fully_reviewed`, `stale_since_proposal`, `✓ trusted`, idempotent replay). _Proof:_ each non-obvious term has hover/aria help text.
4. **[R] Session-expiry surfacing** (decode `exp`, warn before expiry, prompt re-auth) until real SSO lands. _Proof:_ an expired token shows a clear re-auth prompt, not a generic 401.
5. **[R] Minimal design pass** (a real stylesheet/tokens; remove ad-hoc inline CSS). Cosmetic, but it is the single biggest "is this serious?" signal. _Proof:_ consistent type scale, spacing, and table styling via shared styles.
6. **[R] Confirmation affordance on Execute and Pause** (the two highest-consequence buttons) — a one-line confirm, not a modal. _Proof:_ execute/pause require a deliberate second click or inline confirm.

> Note: items 1–6 are **presentation/resilience** hardening. The _governance_
> UI (preview, mandatory reasons, denials, kill switch) is already sound and
> should not be touched casually.

---

# Deliverable 2 — Verification plan

How we prove the system works, at three layers. Layers 1–2 are **[V] in place**;
layer 3 is **[R] partially blocked** on live access.

**Layer 1 — automated, every commit (CI required check).**

- Unit + contract + integration vitest (292 tests) — `pnpm test`.
- Repository contract runs on in-memory **and** real Postgres (PGlite).
- Falsifiable golden eval gate over the real agent runtime (`golden.test.ts`).
- Full-lifecycle acceptance test (`lifecycle.acceptance.test.ts`).
- README evidence-pointer guard + trust-packet attestation-pointer guard
  (docs cannot overclaim past code).
- **[R] gap:** no coverage threshold enforced; no mutation testing; no
  dependency-audit / SAST step in CI (see Deliverable 4 untested areas).

**Layer 2 — pre-deploy, every release.**

- `node apps/api/scripts/smoke-deploy.mjs` (health, auth-fail-closed, email
  fence, governance fence-drift, kill-switch surface, RBAC, readiness). Exits
  non-zero on required failure → pipeline-gateable. Tested in
  `smokeDeploy.test.ts` **[V]**.
- Manual deploy-verification runbook checks 2/6/8 (DB role, kill-switch
  behavior, CRM client mode) — `docs/runbooks/deploy-verification.md` **[V]**.

**Layer 3 — live alpha proof (blocked on humans).**

- Readiness gate → READY (`GET /integrations/readiness`).
- Preflight (zero writes) → expected proposals.
- First `approve → HubSpot task/note` round-trip; idempotency re-run;
  provenance properties present; undo archives + audits.
- Export one trust packet as the point-in-time evidence artifact.
- **Blocked by:** live HubSpot credentials + portal properties + deployed
  infra. Procedure exists (`operator-handoff.md` 12-step) **[V]**; execution is
  **credentials-blocked**.

**Acceptance of the verification plan itself:** Layer 1 green on `main`; Layer 2
script wired into the deploy pipeline as a gate **[R]**; Layer 3 executed once
against a real tenant and its evidence captured **[R, blocked]**.

---

# Deliverable 3 — Internal audit report template

> Fill this per audit cycle. Rule: a control is **"tested"** only if a named
> test or captured artifact proves it; "implemented" without a test is
> **"untested."** Do not write "enterprise-ready" anywhere a blocker in §5 is open.

```
INTERNAL AUDIT REPORT — Cognitia — <date> — base commit <sha>
Auditor: <name>   Scope: <surfaces/controls in scope>

1. VERIFIED IMPLEMENTED CONTROLS
   For each: control id · what it does · file/line · status [V/I/R]
   (only list controls confirmed present in code/config this cycle)

2. TESTED CONTROLS
   For each: control id · test file · what the test asserts · last CI run/date
   · pass/fail. (A control here MUST appear in §1.)

3. UNTESTED AREAS
   Implemented-but-unproven, or absent. For each: area · why it matters ·
   what evidence is missing · owner · target date.

4. WEAK ASSUMPTIONS
   Things we are treating as true without proof. For each: assumption ·
   blast radius if false · how to convert it to verified.

5. BLOCKERS TO AN HONEST "ENTERPRISE-READY" CLAIM
   For each: blocker · class [settings/credentials/infra/data/legal] ·
   owner · what unblocks it. If any row is open, the honest external claim is
   "alpha with a CI-proven governance core," NOT "enterprise-ready."

6. SIGN-OFF
   Score vs prior cycle · top 3 risks · go/no-go for the next expansion gate.
```

**Pre-filled example (this cycle, `cb95fba`) — abbreviated:**

- §1 verified: session-derived auth, RLS isolation, governed write lifecycle,
  kill switch, audit trail, trust packet, scorecards, run plans (all **[V]**).
- §3 untested: live CRM round-trip (blocked); SAST/dep-audit (absent);
  coverage threshold (absent); pgBouncer tenant-context (unverified, R-2).
- §4 weak assumptions: "deploy runs as `app_user`" (unproven until infra);
  "KMS holds the data key" (unprovisioned); "branch protection on" (off today).
- §5 blockers: branch protection [settings]; live creds [credentials]; app_user/
  KMS/TLS/backups [infra]; email scope [legal — out of current scope].

---

# Deliverable 4 — SOC-ready control matrix

> **Scope (recommended):** the Cognitia API + worker + operator console and the
> Postgres data store, single-region, for the governed HubSpot CRM write-back
> workflow. **Out of scope (this cycle):** email/multichannel, voice, any
> ecosystem/token work.
> **Trust Services Criteria (recommended):** **Security (Common Criteria)** as
> the required baseline; add **Confidentiality** (we hold tenant CRM data +
> credentials) and **Availability** (operators depend on the service).
> **Defer** Processing Integrity and Privacy until email/PII-processing scope
> exists. Target **Type 1 first** (point-in-time), with automation so a Type 2
> window accrues. **[R]** onboard a compliance automation tool (Vanta/Drata) day 1.

Status legend: ✅ implemented+tested · 🟫 implemented, untested/partial · ⛔ not yet.
Each control: objective · owner · status · evidence required · how to test · risk if missing.

### Security / Common Criteria

| ID      | Control objective                                           | Owner            | Status                                           | Evidence required                                             | How to test                                            | Risk if missing                   |
| ------- | ----------------------------------------------------------- | ---------------- | ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------- |
| CC6.1-a | Logical access: tenant isolation (no cross-tenant read)     | ENG-platform     | ✅ **[V]** code/tests; 🟫 prod role              | `kysely.rls.pglite.test.ts` CI run; prod DB role = `app_user` | Run RLS test; `select current_user` via app path       | Cross-tenant data leak            |
| CC6.1-b | Authz derived from verified principal, not client input     | ENG-platform     | ✅ **[V]**                                       | `serverAuth.test.ts`; `auth.ts`                               | Forge `x-tenant-id` + no session → 401 (smoke check 2) | Auth bypass / impersonation       |
| CC6.1-c | RBAC: viewer/operator/owner; owner-only resume              | ENG-platform     | ✅ **[V]**                                       | `killSwitch.test.ts`, smoke RBAC                              | viewer POST run → 403; operator resume → 403           | Privilege escalation              |
| CC6.6   | Credentials encrypted at rest (AES-GCM, KMS key)            | Security         | 🟫 **[I]** (code path exists; KMS unprovisioned) | `tokenProvider.test.ts`; KMS key ARN                          | Decrypt fails without `CREDENTIAL_SECRET_KEY_BASE64`   | Token theft → CRM compromise      |
| CC6.7   | No raw PII/secrets in logs                                  | ENG-platform     | ✅ **[V]**                                       | `logging.test.ts`; log sample                                 | grep logs for token/email → absent                     | PII/secret exposure               |
| CC6.8   | Idempotent external writes (no duplicate side effects)      | ENG-integrations | ✅ **[V]**                                       | `crmExecute.test.ts`, `writePlan.test.ts`                     | Execute twice → one object                             | Duplicate/incorrect CRM writes    |
| CC7.2-a | Detection: deploy smoke catches fence/auth drift            | ENG-platform     | ✅ **[V]**                                       | `smokeDeploy.test.ts`; pipeline run                           | Flip email-executable → smoke FAIL                     | Silent control regression in prod |
| CC7.2-b | Immutable audit trail of every action transition + denial   | ENG-platform     | ✅ **[V]**                                       | `governance.test.ts`; `GET /audit`                            | Execute-before-approve → `execution_denied` row        | No forensic record                |
| CC7.3   | Kill switch halts execution + rollback per tenant           | ENG-platform     | ✅ **[V]**                                       | `killSwitch.test.ts`                                          | Pause → execute 409, zero writes                       | Cannot stop a misbehaving tenant  |
| CC7.4   | Incident response runbook + severities                      | Security         | 🟫 **[V] doc**                                   | `incident-response.md`; one drill record                      | Table-top a SEV-1                                      | Slow/chaotic incident handling    |
| CC8.1-a | Change management: PR review + required CI checks           | ENG-lead         | 🟫 **[V] CI / ⛔ branch protection**             | GitHub branch-protection export                               | Try direct push to base → blocked                      | Unreviewed/regressing changes     |
| CC8.1-b | Regression-enforced product truth (eval + acceptance gates) | ENG-platform     | ✅ **[V]**                                       | `golden.test.ts`, `lifecycle.acceptance.test.ts`              | Break an invariant → CI red                            | Trust claims silently rot         |
| CC9.2   | Vendor management (HubSpot, hosting, KMS) register          | Security         | 🟫 **[V] doc**                                   | `vendor-access-register.md`; DPAs                             | Review register vs actual integrations                 | Unmanaged third-party risk        |

### Confidentiality

| ID   | Control objective                          | Owner        | Status                             | Evidence required                  | How to test                      | Risk if missing            |
| ---- | ------------------------------------------ | ------------ | ---------------------------------- | ---------------------------------- | -------------------------------- | -------------------------- |
| C1.1 | CRM data + credentials confined per tenant | ENG-platform | ✅ **[V]** isolation; 🟫 prod role | RLS tests; DB grants               | Tenant B cannot read A           | Confidentiality breach     |
| C1.2 | Data retention / deletion on offboarding   | Security     | ⛔ **[R]**                         | retention policy + deletion script | Offboard test tenant → data gone | Stale data, GDPR exposure  |
| C1.3 | Least-privilege HubSpot scopes             | Operator     | 🟫 **[V] doc**                     | scope screenshot (onboarding)      | Inspect granted scopes           | Over-broad external access |

### Availability

| ID   | Control objective                                        | Owner            | Status     | Evidence required                   | How to test               | Risk if missing         |
| ---- | -------------------------------------------------------- | ---------------- | ---------- | ----------------------------------- | ------------------------- | ----------------------- |
| A1.1 | Backups + PITR                                           | Infra            | ⛔ **[R]** | backup config; restore-drill record | `backup-restore-drill.md` | Unrecoverable data loss |
| A1.2 | Health/liveness probe                                    | ENG-platform     | ✅ **[V]** | `GET /health`; smoke check 1        | Stop DB → 503             | Undetected outage       |
| A1.3 | Rate-limit/backoff to a fragile dependency (HubSpot 429) | ENG-integrations | ✅ **[V]** | `httpClient.test.ts`                | Simulate 429 → backoff    | Cascading failure / ban |

---

# Deliverable 5 — Gap list ranked by severity

Severity = (likelihood × impact) on an honest enterprise claim. Each gap: class,
owner, what closes it. **None of these are "the governance core is broken"** —
that is verified sound; these are the things between "CI-proven alpha" and
"defensible SOC Type 1."

| #   | Sev        | Gap                                                               | Class       | Owner        | What closes it                                                                                                               |
| --- | ---------- | ----------------------------------------------------------------- | ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | **High**   | Branch protection + required checks OFF on the base branch        | settings    | ENG-lead     | Enable in GitHub settings (CC8.1-a) — **closable today by the human**                                                        |
| 2   | **High**   | Deploy-time identity unproven: `app_user` role, KMS data key, TLS | infra       | Infra        | Provision + capture evidence (R-1, R-3, A1.1)                                                                                |
| 3   | **High**   | No live end-to-end proof (no real CRM round-trip yet)             | credentials | Operator     | Run the 12-step handoff once creds exist                                                                                     |
| 4   | **Med**    | No SAST / dependency-vulnerability scan in CI                     | code        | ENG-platform | Add `pnpm audit` (or Socket/Snyk) + a SAST step as required checks                                                           |
| 5   | **Med**    | No test-coverage threshold; coverage unmeasured                   | code        | ENG-platform | Add vitest coverage + a CI floor (don't gate-raise blindly)                                                                  |
| 6   | **Med**    | pgBouncer tenant-context (`SET LOCAL`) unverified on pooled infra | infra       | ENG-platform | Validate on real pooled Postgres (R-2)                                                                                       |
| 7   | **Med**    | Data retention/deletion + tenant offboarding absent               | policy      | Security     | Write + script retention/deletion (C1.2)                                                                                     |
| 8   | **Closed** | Security docs anchored to a stale commit; conflicting claims      | docs        | Security     | ✅ HARD-4: re-anchored control-matrix/risk-register/evidence-checklist; corrected the wrong AC-2 auth row to session-derived |
| 9   | **Low**    | UI presentation/resilience (monolith, silent errors, no design)   | product     | ENG-web      | Deliverable-1 fixes 1–6                                                                                                      |
| 10  | **Low**    | No incident/restore **drill records** (runbooks exist, undrilled) | process     | Security     | Run one drill each; capture artifacts                                                                                        |
| 11  | **Low**    | Accessibility unaudited                                           | product     | ENG-web      | a11y pass on the console                                                                                                     |

---

# Deliverable 6 — Acceptance criteria for "ready for implementation"

The next expansion gate may open **only when all of the following are true.**
Split into what's closable now vs externally blocked, so progress is honest.

**Must be green to claim "hardened core" (closable now / this cycle):**

- [ ] Branch protection + required `build-test` check + linear-history on base **[R, settings]**
- [ ] CI adds: dependency-vulnerability scan + SAST + coverage report (floor set, not gamed) **[R, code]**
- [ ] Security `control-matrix.md` / `risk-register.md` re-anchored to this package; the stale "header-trust" auth claim removed **[R, docs]**
- [ ] Data retention + tenant-offboarding policy written, with a deletion script and a test **[R, policy+code]**
- [ ] One incident-response table-top **and** one backup/restore drill executed, with artifacts filed **[R, process]**
- [ ] UI Deliverable-1 fixes 1–4 shipped (tabs, loading/empty/error states, term tooltips, session-expiry) **[R, product]**
- [ ] This package committed; internal audit report (Deliverable 3) filled for the cycle **[R, docs]**

**Must be green to claim "enterprise-ready / SOC Type 1 ready" (externally blocked):**

- [ ] Deployed as `app_user` (non-superuser), TLS, KMS data key provisioned, backups+PITR on **[infra]**
- [ ] One live CRM round-trip executed end to end; trust packet exported as point-in-time evidence **[credentials]**
- [ ] pgBouncer tenant-context validated on real pooled Postgres **[infra]**
- [ ] Compliance tool (Vanta/Drata) collecting continuous evidence **[settings/vendor]**

**Honest claim ladder (use the highest fully-green rung, no higher):**

1. _"CI-proven governance core, alpha"_ — **true today [V].**
2. _"Hardened core"_ — when the first block above is fully green.
3. _"SOC 2 Type 1 ready"_ — when the second block is green and a readiness
   assessment passes.
4. _"SOC 2 Type 2"_ — only after an observation window with continuous evidence.

> Do not advance a rung on the strength of intent. Each checkbox needs an
> artifact (a CI run, a settings export, a drill record, an exported packet).

---

# Task E — Exact build order, next two weeks

Optimized for **product hardening and audit evidence, not feature sprawl**.
Ordered so the human-only unblockers (settings/infra) run in parallel with the
code/doc work that does not need them. "[blocked]" items wait on the owner named
in Deliverable 5. Each day ends mergeable; cadence matches the repo
(branch → tests → docs → green CI → squash-merge → re-verify on base).

**Week 1 — make the claims defensible and stop drift.**

- **Day 1 — HARD-2 (settings, human):** enable branch protection on the base
  branch (required `build-test` check, review required, linear history) +
  auto-merge. _Closes gap #1._ Owner: ENG-lead. _Proof:_ a direct push is
  rejected; settings export filed.
- **Day 1–2 — HARD-3 (code):** add CI required steps — `pnpm audit` (or
  Socket/Snyk) for dependency CVEs, a SAST pass, and a vitest coverage report
  with a conservative floor. _Closes gaps #4, #5._ _Proof:_ a planted vulnerable
  dep / uncovered critical path fails CI.
- **Day 2 — HARD-4 (docs):** re-anchor `control-matrix.md` + `risk-register.md`
  to this package; delete the stale "header-trust" auth row; point both at the
  verified session-derived auth and the new controls. _Closes gap #8._
- **Day 3–4 — HARD-5 (policy+code):** data retention + tenant-offboarding
  policy; implement a tenant-deletion path (cascade is already FK-modeled) with
  a test proving a deleted tenant's rows are gone. _Closes gap #7 / C1.2._
- **Day 4–5 — HARD-6 (process):** run one incident-response table-top and one
  backup/restore drill (against the ephemeral/PGlite stand-in where infra is
  absent, noting the gap); file both artifacts. _Closes gap #10._

**Week 2 — make it look serious and capture live evidence.**

- **Day 6–8 — HARD-7 (product, UI):** Deliverable-1 fixes 1–4 — split the
  console into tabs/routes; add per-panel loading/empty/error states; add term
  tooltips; surface session expiry. _Closes gap #9 (the high-value half)._
  _Proof:_ each surface renders independently with explicit empty/error states.
- **Day 8–9 — HARD-8 (product, UI):** minimal design pass (shared styles/
  tokens, remove ad-hoc inline CSS) + confirm affordance on Execute/Pause.
  _Closes the rest of gap #9._
- **Day 9–10 — HARD-9 (verification):** wire `smoke-deploy.mjs` into the deploy
  pipeline as a hard gate; fill the Deliverable-3 internal audit report for the
  cycle. _Completes the "hardened core" acceptance block._

**Parallel track (Infra/Operator, human-owned, not on the code critical path):**

- Provision `app_user` role, TLS, KMS data key, backups+PITR _(gap #2)_.
- Validate pgBouncer tenant-context on pooled Postgres _(gap #6)_.
- Once creds exist: run the 12-step handoff → first live CRM round-trip →
  export the trust packet as point-in-time evidence _(gap #3)_.
- Onboard Vanta/Drata for continuous evidence.

**Definition of done for the two weeks:** the entire "hardened core" acceptance
block (Deliverable 6, first list) is green with artifacts; the "enterprise-ready"
block is tracked with each item correctly classified as settings/credentials/
infra-blocked. The honest external claim at end of Week 2, if the parallel infra
track has not completed, remains **"hardened core, alpha"** — not "enterprise-
ready" — and this document says so explicitly.
