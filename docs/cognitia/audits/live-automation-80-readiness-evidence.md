# Live-Automation 80 — Readiness Audit & Evidence

Date: 2026-06-22
Audit branch: `claude/automation-readiness-audit-8q32n9`
Base / source of truth: **PR #158 / `overnight/gtm-implementation` (HEAD `407a724`)** reconciled with
PR #159 (integration hardening) and PR #160 (GTM Command Center) on the **newest consolidated Alta
candidate** `claude/alta-90-readiness-audit-lp6jr7` (HEAD `1556d5b`). That consolidated line is a
strict superset: it contains the B1–B6 GTM mock lanes _and_ the pre-existing `apps/api` Mira/Closer
platform (real ledger, real HubSpot OAuth connector, Postgres+RLS) that the prior GTM-only audits
under-weighted. This audit scores the **whole line**.

> **What this document is.** A final, evidence-cited readiness audit that scores **three distinct
> automation axes separately** — dry-run, controlled-live, and actual-live — with a file, test, or
> command result behind every number. Where evidence does not support a number, the number stays low
> and the exact blocker is named.

> **Honesty / safety contract.** Nothing here was taken live. No live outreach, no vendor send API,
> no real CRM write, no raw PII, Budget Wheels sandbox only (`budget_wheels_demo` / Tenant Zero), all
> channel plans `sent:false`, the live send path (`sendLive`) always throws, the real CRM connector
> is wired **only** when out-of-band env + credentials are present (and is still approval-, consent-,
> kill-switch- and readiness-gated), and **no PR state was changed** by this audit (all remain draft).

---

## 0. Verification run on this branch HEAD (basis for every score)

| Gate                   | Command                 | Result                                                       |
| ---------------------- | ----------------------- | ------------------------------------------------------------ |
| Format                 | `pnpm run format:check` | ✅ all matched files use Prettier style                      |
| Typecheck (root + web) | `pnpm run typecheck`    | ✅ clean (`tsc -p tsconfig.json` + `@cognitia/web` `tsc`)    |
| Tests                  | `pnpm run test`         | ✅ **829 passed / 829 — 108 test files** (`vitest run`, 52s) |
| Aggregate              | `pnpm run check`        | ✅ green end-to-end (format → typecheck → test)              |

Test count was verified directly (`grep -cE '^\s*(it|test)\('` per file); the per-file numbers cited
below are the verified counts, not estimates. (During this audit a fan-out helper over-reported some
counts — e.g. claimed `rollback.test.ts`=39 / `killSwitch.test.ts`=10; the verified figures are
**5** and **7**. Every number in this doc is the re-counted value.)

### Safety scans run over production sources on this branch

| Scan                    | Method                                                                                                                | Result                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live send-SDK egress    | grep `nodemailer`/`twilio`/`sendgrid`/`postmark`/`mailgun`/`whatsapp`/`googleapis` across new lanes + web view-models | ✅ none imported (only the `whatsapp` channel-type **string** and a `555-0101` sandbox placeholder)                                                               |
| `sendLive` fail-closed  | `packages/agents/src/channels/dryRunChannels.ts:144`                                                                  | ✅ returns `never`; throws on every branch                                                                                                                        |
| Dry-run invariant       | `packages/agents/src/channels/dryRunChannels.ts:91-92`                                                                | ✅ `mode:'dry_run'`, `sent:false` (literal types)                                                                                                                 |
| Real connector egress   | `packages/integrations/src/hubspot/httpClient.ts:279`, `tokenProvider.ts:221`, `sync.ts:198`                          | ⚠️ **REAL** injected `fetch` exists (CRM v3 REST + OAuth); defaults to `globalThis.fetch` **only** when constructed in `server.ts` with env present — see §3 / §5 |
| Deployment artifacts    | look for `vercel.json` / `Dockerfile` / `docker-compose.yml` / `fly.toml` / deploy workflow                           | ✅ **none present**; `.github/workflows/ci.yml` is build/test only (no deploy/release/secrets step)                                                               |
| Secrets in repo         | `.env.example` keys                                                                                                   | ✅ placeholders only (`HUBSPOT_CLIENT_SECRET=`, `EMAIL_PROVIDER_API_KEY=`, `ANTHROPIC_API_KEY=`, `CREDENTIAL_SECRET_KEY_BASE64`)                                  |
| Raw PII (emails/phones) | grep real-TLD emails / phones outside `555-01xx`                                                                      | ✅ none in prod sources (off-list values exist only inside guard-rejection tests)                                                                                 |
| Budget Wheels wording   | grep `budget.?wheels` minus demo/sandbox/Tenant-Zero qualifiers                                                       | ✅ all references are `budget_wheels_demo` / sandbox-qualified                                                                                                    |

---

## 1. The three readiness scores (reported separately, on purpose)

These axes are **not** the same thing. A high dry-run score is **not** a live-readiness score. Per the
universal rules they are scored apart, and the live axes are gated.

| #   | Axis                                 | Score        | One-line basis                                                                                                                                                                                                                                                 |
| --- | ------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Dry-run automation readiness**     | **88 / 100** | Two independent, tested dry-run systems (GTM channel engine `sent:false` + `apps/api` zero-write preflight), a Command Center that renders them, fail-closed `sendLive`. Held < 90 by in-memory persistence + mock metrics + no hosted URL.                    |
| 2   | **Controlled-live readiness**        | **74 / 100** | All nine required elements exist as tested code (gates, kill switch, approval, consent, monitoring, rollback, sandbox harness, tests, Command Center). Held **below 80** by no deployed env, no wired live alerting, unbound 7-signoff gate, env unconfigured. |
| 3   | **Actual live automation readiness** | **20 / 100** | Real HubSpot OAuth connector + Postgres/RLS + AES secret store **code** exists and is conditionally wired, but no deployment, no credentials, no signed legal/consent/customer, outreach channels hard-disabled, no live proof. Stays low by design.           |

**Headline verdict.** Dry-run is a credible **88**. Controlled-live **machinery** is real and
tested but operationally not deployable, so it is honestly held at **74 (below the 80 gate)**. Actual
live automation is **20** — low, but not the near-zero a pure-mock system would score, because a
genuine CRM connector and infra-wiring exist (just not deployed, credentialed, or legally cleared).

---

## 2. Axis 1 — Dry-run automation readiness → **88 / 100**

Two separate, independently tested dry-run engines, plus a visible operator surface.

| Capability                                                                                                                               | Evidence (file:line / test → verified count)                                                                                                                                                      | Status         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **GTM channel engine** — `planDryRunAction` always `{mode:'dry_run', sent:false}` for all 7 channels                                     | `packages/agents/src/channels/dryRunChannels.ts:85-104` (`:91-92`); `dryRunChannels.test.ts` (**11**)                                                                                             | DRY-RUN ✅     |
| `assertNoLiveSend` runtime tripwire (throws on forged `sent`/`mode`)                                                                     | `dryRunChannels.ts:119-134`; tested in `dryRunChannels.test.ts` + `runPacket.test.ts:143`                                                                                                         | SAFE ✅        |
| `sendLive` always throws; gate impossible by construction                                                                                | `dryRunChannels.ts:144-158`; `channelPolicy.ts` `IMPOSSIBLE_RELEASE_GATE` / `isReleaseGateOpen`; `channelPolicy.test.ts` (**11**)                                                                 | SAFE ✅        |
| **`apps/api` zero-write preflight** — real Mira runtime simulated with **zero** CRM writes                                               | `apps/api/src/handlers.ts` preflight (SIM-1); `apps/api/src/preflight.test.ts`; control `zero_write_preflight` in `trustPacket.ts`                                                                | DRY-RUN ✅     |
| **Golden-eval harness** — real runtime over fixtures, scope-fence + idempotency invariants must score 1.0                                | `packages/evals/src/harness.ts`; `packages/evals/src/golden.test.ts`                                                                                                                              | SANDBOX ✅     |
| **Integrated run packet** — one packet calling **real** B1–B6, build-time `assertSendLiveFailsClosed` + `assertIntegratedPacketNoRawPii` | `packages/agents/src/gtm-os/integration/{runPacket,adapters}.ts`; `runPacket.test.ts` (**8**)                                                                                                     | MOCK ✅        |
| **Command Center route** renders the dry-run state, persistent MOCK banner, **no send controls**                                         | route `/gtm-command-center` → `apps/web/src/app/gtm-command-center/page.tsx`; `gtmCommandCenterViewModel.ts` (`.test.ts` **30**); `page.smoke.test.tsx` (**5**, asserts no `<button>`/"send now") | MOCK ✅ builds |
| **Integrated demo route** runs real `@cognitia/agents` via server-only adapter                                                           | route `/gtm-os-integrated-demo` → `apps/web/src/app/gtm-os-integrated-demo/page.tsx`; `lib/server/gtmIntegratedDemoData.ts` (`.test.ts` **9**)                                                    | MOCK ✅ builds |

**Why 88 and not higher:** GTM CRM-lite / timeline / proofs are in-memory per request
(`packages/agents/src/crm-lite/mockCrmLite.ts`), TrustOps runs over a fixed scenario not stored runs
(`trustops/metrics.ts`), and there is no hosted URL or recorded run artifact — depth/observability
gaps, not safety gaps.

---

## 3. Axis 2 — Controlled-live readiness → **74 / 100** (held below the 80 gate)

**Gate rule:** controlled-live may score 80+ **only if** gates, kill switch, approval, consent,
monitoring, rollback, sandbox harness, tests, and Command Center evidence **all** exist. Below is the
nine-element check. **All nine exist as tested code** — which is why this is the strongest axis after
dry-run — but four operational gaps (§3.1) keep it honestly at **74**, under 80.

| #   | Required element    | Evidence (file:line / route / test → verified count)                                                                                                                                                                                                                                                                                                                                                                                    | Verdict                    |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1   | **Gates**           | `packages/agents/src/security/releaseGate.ts:60-72` (`STAGE_REQUIREMENTS`; `controlled_live` = 7 conditions, fails closed) → `releaseGate.test.ts` (**14**); **and** the live readiness gate `apps/api/src/handlers.ts` `integrationReadiness` (RDY-1) → `integrationReadiness.test.ts` (**5**)                                                                                                                                         | ✅ present                 |
| 2   | **Kill switch**     | **ENFORCED**, not documented: `packages/agents/src/ledger/actionLedger.ts:398-404` (`connectionHalt`) gates both `execute` (`:200-211`) and `rollback` (`:289`); pause (any operator) / resume (owner-only) in `apps/api/src/handlers.ts`; RLS round-trip in PGlite repo contract → `killSwitch.test.ts` (**7**) + db contract test                                                                                                     | ✅ enforced                |
| 3   | **Approval**        | Human approval is the chokepoint: `apps/api/src/handlers.ts` `approveAction`/`rejectAction`/`executeAction`/`batch*` with mandatory closed-enum reasons; operator console route `/approvals` → `apps/web/src/app/approvals/page.tsx`; `approvalQueue.test.ts`, `decisionReasons.test.ts`, `fence.test.ts`                                                                                                                               | ✅ real                    |
| 4   | **Consent**         | Suppression/consent enforced, not cosmetic: `contacts.is_suppressed` column + index (`packages/db/migrations/0003_gtm_entities.sql:34,84`), `consent_captured` (`0011_moveros_lead_rescue.sql:30`), `PolicyGate` blocks suppressed targets (`packages/agents/src/policies/policyGate.ts:25-37` via `decideApproval` in `packages/core/src/policies`), dry-run consent boolean in `channelPolicy.ts` (`.test.ts` denies `consent:false`) | ✅ present (boolean-grade) |
| 5   | **Monitoring**      | Real audit trail + live trust-packet export: `apps/api/src/trustPacket.ts` (14 code-derived control attestations, golden eval run at export); `/audit` + `/governance` feeds; TrustOps metrics/report (mock) → `trustops/metrics.test.ts` (**16**), `report.test.ts`                                                                                                                                                                    | ⚠️ partial — see §3.1      |
| 6   | **Rollback**        | **Real**, reversible (not a flag): `actionLedger.ts:266-321` (`rollback`, idempotent, kill-switch-gated, audited); real adapter `packages/integrations/src/hubspot/adapter.ts` archives via the connector → `apps/api/src/rollback.test.ts` (**5**), `packages/integrations/src/hubspot/rollback.test.ts` (**8**)                                                                                                                       | ✅ real                    |
| 7   | **Sandbox harness** | `apps/api/src/pilotProofHarness.test.ts` (**7**, real mainline primitives), `apps/api/src/lifecycle.acceptance.test.ts` (**1** full loop: readiness→preflight→propose→preview/write parity→approve→execute→kill-switch→resume→undo→reject→regression), `packages/evals/src/golden.test.ts`                                                                                                                                              | ✅ present                 |
| 8   | **Tests**           | `pnpm run test` → **829 / 829 passed, 108 files** (§0); CI runs format+typecheck+test on every push (`.github/workflows/ci.yml`)                                                                                                                                                                                                                                                                                                        | ✅ green                   |
| 9   | **Command Center**  | `/gtm-command-center` (mock parity board) + `/approvals` (live operator console) + trust-packet export are all present, tested, and build (§2)                                                                                                                                                                                                                                                                                          | ✅ present                 |

**All nine present** → the _necessary condition_ for 80+ is technically met. The score is still held
**below 80** because "controlled-live readiness" means _could a controlled live pilot actually run_,
and four operational gaps say not yet:

### 3.1 The four blockers keeping controlled-live at 74 (not 80+)

1. **No deployed / reachable environment.** No `vercel.json`, `Dockerfile`, or deploy workflow exists
   (§0 scan); CI is build/test only. Everything is proven as tests, not a running URL with telemetry.
2. **Monitoring is post-hoc, not real-time.** The "monitoring" evidence is an audit trail + an
   on-demand trust-packet export + **mock** TrustOps metrics — there is no wired live alerting, SLO,
   on-call, or observability dashboard. The `monitoringEnabled` gate condition
   (`releaseGate.ts:34`) is an out-of-band boolean, not an integration.
3. **The 7-signoff release gate is not bound to the real execute path.**
   `packages/agents/src/security/releaseGate.ts` (counsel/founder/customer-scope booleans) is a pure
   decision function that nothing in `apps/api`'s `executeAction` actually consults; the real
   chokepoints that _do_ fire are human approval + kill switch + RDY-1 readiness. Binding the
   release-gate signoffs to execution is unbuilt.
4. **Env unconfigured + routes credential-gated.** Operator routes fail closed without `SESSION_SECRET`
   (`apps/api/src/server.ts`), the real connector only wakes with `CREDENTIAL_SECRET_KEY_BASE64`
   (`server.ts:525-536`), and `.env.example` holds placeholders only. The machinery is dark until an
   operator provisions it out-of-band.

---

## 4. Axis 3 — Actual live automation readiness → **20 / 100** (must stay low)

**Gate rule:** actual-live must stay lower than controlled-live **unless** real legal / client /
connector / deployment evidence exists. Of those four, **only connector evidence exists** — which is
why this is **20** (a real connector lifts it off the floor) rather than the **0** a pure-mock system
would earn, but it is still far below the live axes.

| Live precondition            | Evidence present?                                                                                                                                                                                                                       | Effect on score                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Real connector code**      | ✅ YES — `packages/integrations/src/hubspot/httpClient.ts` (CRM v3 REST, OAuth via `tokenProvider.ts`, retry/backoff, PII-hash), wired in `apps/api/src/server.ts:525-536` behind `CREDENTIAL_SECRET_KEY_BASE64`; real rollback adapter | the only thing lifting it above 0 |
| **Deployment evidence**      | ❌ none — no `vercel.json`/`Dockerfile`/deploy workflow; CI is build/test only                                                                                                                                                          | keeps it low                      |
| **Legal / counsel signoff**  | ❌ none — `counselSignoff`/`founderSignoff` are unset sandbox booleans; no signed artifact in repo                                                                                                                                      | keeps it low                      |
| **Client / consent records** | ❌ none real — `signedCustomerScope` unset; no signed customer scope; only `budget_wheels_demo` / Tenant-Zero sandbox tenants in fixtures                                                                                               | keeps it low                      |
| **Live credentials / env**   | ❌ none — `.env.example` placeholders; `CREDENTIAL_SECRET_KEY_BASE64`/`DATABASE_URL`/`SESSION_SECRET` unset → connector falls back to fake + warns (`server.ts:539-545`)                                                                | keeps it low                      |
| **Outreach channels live**   | ❌ disabled by construction — `sendLive` throws (`dryRunChannels.ts:144`); channel scope fence limits even the live path to CRM tasks/notes (`fence.test.ts`, control `channel_scope_fence`)                                            | keeps it low                      |
| **Live proof / receipt**     | ❌ none — no executed real-tenant run, no production receipt artifact committed                                                                                                                                                         | keeps it low                      |

**Net:** one of four required live evidences (connector) is real; the other three (legal, client,
deployment) are absent. Actual-live is **20** and **must not rise** until signed legal + signed
customer scope + provisioned credentials + a deployed, monitored environment exist out-of-band.

---

## 5. The key reconciliation this audit adds

The prior GTM-only audits (`alta-80-readiness-evidence.md`, `alta-80-command-center-evidence.md`,
`alta-90-final-readiness-evidence.md`) scored "live automation" at **12** because they measured the
**B1–B6 mock lanes**, where `sendLive` always throws and nothing is real. That is correct **for the
GTM lanes**. This audit additionally inspects the pre-existing **`apps/api` Mira/Closer platform** on
the same consolidated line and finds:

- a **real** approval-gated action ledger (`actionLedger.ts`) with enforced kill switch + reversible
  rollback,
- a **real** HubSpot CRM v3 connector with OAuth, retry, and PII-hashing (`httpClient.ts`),
- a **real** Postgres repository with row-level tenant isolation (PGlite contract test in `pnpm test`),
- an **AES-GCM** per-tenant secret store + token provider, conditionally wired in `server.ts`.

That platform is what makes **controlled-live machinery genuinely present (74)** and **actual-live
non-zero (20)** — distinctions the GTM-only lens missed. It does **not** raise any axis to "live":
the connector is dark without out-of-band credentials, there is no deployment, and no legal/client
evidence exists. The honest split stands: **dry-run 88, controlled-live 74 (< 80 gate),
actual-live 20.**

---

## 6. Exact remaining blockers (what unblocks each axis)

**Dry-run → 90+:** persist GTM CRM-lite/timeline/proofs (`@cognitia/db`); run TrustOps over stored
runs not a fixed scenario; publish a hosted demo URL + recorded run artifact.

**Controlled-live → 80+ (in-scope engineering, no forbidden deps):**

1. Deploy a reachable, monitored environment (no deploy config exists today).
2. Wire real-time observability/alerting (today: audit trail + packet export + mock metrics only).
3. Bind `releaseGate.ts` 7-signoff conditions to the `executeAction` path (today: unconsulted).
4. Provision `SESSION_SECRET` + bind the `permissionModel.ts` roles to route/UI access.

**Actual-live → above 20 (forbidden in any overnight lane; require external sign-off):** 5. Signed counsel + founder sign-off; signed customer scope; consent provenance records. 6. Live connector approval + provisioned `CREDENTIAL_SECRET_KEY_BASE64` + real OAuth credentials. 7. A deployed, monitored environment with a tested rollback drill and a recorded live receipt.
Until all of these exist, actual-live **must not** be raised — and outreach channels stay disabled
regardless (`sendLive` throws; scope fence is CRM-only).

---

## 7. Acceptance check

- ✅ Three axes scored **separately** — dry-run **88**, controlled-live **74**, actual-live **20**.
- ✅ Controlled-live is **below 80**; the nine-element check is shown (all present) and the four
  operational blockers that hold it under 80 are named (§3.1).
- ✅ Actual-live stays **lower** than controlled-live and is justified element-by-element against the
  real-legal/client/connector/deployment bar (§4); only connector evidence exists.
- ✅ Every score cites a file:line, a route, a test (with **verified** counts), or a command result.
- ✅ Safety honored — no live outreach, no vendor send SDK imports, `sendLive` proven fail-closed, no
  raw PII, Budget Wheels sandbox only, real connector dark without out-of-band creds, **no PR state
  changed** (all remain draft). Going actual-live remains blocked by construction.
