# Alta 90 — Final Readiness Audit & Evidence

Date: 2026-06-22
Audit branch: `claude/alta-90-readiness-audit-lp6jr7`
Source of truth: PR #158 / `overnight/gtm-implementation` (HEAD `407a724`), with PR #159
(integration hardening) and PR #160 (GTM Command Center route) **reconciled into the same
line** for this audit (both merged cleanly; barrel + `vitest.config.ts` auto-merged).

> **What this document is.** A final, evidence-cited score after all implementation work on the
> mock-safe GTM line. Every number below is backed by a file, a test, or a command result that was
> run on this branch HEAD — not by assertion. Where evidence does not support a number, the number
> stays low and the blocker is named.

> **Honesty contract.** Nothing here is live. There is **no live egress**, no vendor send SDK, no
> real CRM write, no raw PII. Budget Wheels appears only as `budget_wheels_demo` / Tenant Zero
> sandbox. The live path (`sendLive`) always throws and the `controlled_live` release gate fails
> closed behind 7 sign-offs. **No live-automation or customer-proof claim is made.**

---

## 0. Verification run on this branch HEAD (the basis for every score)

| Gate                   | Command                                                | Result                                                                            |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Format                 | `pnpm run format:check`                                | ✅ all matched files use Prettier style                                           |
| Typecheck (root + web) | `pnpm run typecheck`                                   | ✅ clean (`tsc -p tsconfig.json` + `@cognitia/web` `tsc`)                         |
| Tests                  | `pnpm run test` (`vitest run`)                         | ✅ **829 passed / 829 (108 files)**                                               |
| Aggregate              | `pnpm run check`                                       | ✅ green end-to-end (format → typecheck → test)                                   |
| **Production build**   | `pnpm --filter @cognitia/web run build` (`next build`) | ✅ **22 routes built**, incl. `/gtm-command-center` and `/gtm-os-integrated-demo` |

### Reconciliation fixes applied this pass (clean, scoped — 5 files, +17/-5)

The prior lane (`alta-80-readiness-evidence.md` §1.1) documented that `next build` was **not**
exercised and would require config that "is not in this lane's owned files." This final pass owns the
whole line, so the documented blocker was closed and verified:

1. `apps/web/next.config.mjs` — added `transpilePackages` for the four `@cognitia/*` TS packages and a
   webpack `extensionAlias` (`.js` → `.ts/.tsx`) so Next resolves the agents package's ESM `.js`
   specifiers. This is the exact fix the readiness doc named (§1.1, item 1).
2. Removed the `.js` extension from **value** imports in the route compile graph (4 files:
   `gtm-command-center/page.tsx`, `gtm-os-integrated-demo/page.tsx`,
   `lib/server/gtmIntegratedDemoData.ts`, `lib/gtmCommandCenterViewModel.ts`) to match the
   established extensionless convention every other web route uses. Bundler resolution keeps `tsc`
   green; webpack can now resolve them.

These are build-correctness fixes only. No behavior, no new capability, no live path.

### Safety scans (run over production sources on this branch)

| Scan                   | Method                                                                                                                                                                                         | Result                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Live egress            | grep for `fetch(`/`axios`/`http.request`/`net.`/`WebSocket` + send SDKs (`nodemailer`/`twilio`/`sendgrid`/`postmark`/`mailgun`/`whatsapp`/`googleapis`) across all new lanes + web view-models | ✅ none in production sources (only the `whatsapp` **channel-type string** and a `555-0101` sandbox placeholder) |
| Vendor send SDK        | same grep                                                                                                                                                                                      | ✅ none imported anywhere                                                                                        |
| `sendLive` fail-closed | `packages/agents/src/channels/dryRunChannels.ts:144`                                                                                                                                           | ✅ returns `never`; **throws on both branches**                                                                  |
| Dry-run invariant      | `dryRunChannels.ts:91-92`                                                                                                                                                                      | ✅ `mode:'dry_run'`, `sent:false` (literal type)                                                                 |
| Raw PII (emails)       | grep real-TLD emails in new prod code                                                                                                                                                          | ✅ none (off-list values exist only inside guard-rejection tests)                                                |
| Raw PII (phones)       | grep phone patterns outside `555-01xx`                                                                                                                                                         | ✅ none                                                                                                          |
| Budget Wheels wording  | grep `budget.?wheels` minus demo/sandbox/Tenant-Zero qualifiers                                                                                                                                | ✅ all 29 references are `budget_wheels_demo` / sandbox-qualified                                                |

---

## 1. The four-axis score (honest)

These are **separate axes**. A high mock/dry-run capability score is **not** a live-readiness score —
they are reported apart on purpose, per the universal rules.

| Axis                                                                | Score        | One-line basis                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Alta implementation parity** (mock/dry-run capability breadth) | **85 / 100** | All 8 GTM capability areas implemented as tested code, integrated, visible, and now building; depth (persistence, real connectors, data providers) is mock/in-memory, which caps it below 90                                     |
| **B. Enterprise readiness**                                         | **48 / 100** | Strong fail-closed gates + permission model + PII/egress guards exist, but no persistence, no deployment, no monitoring/rollback wired, and the gate/permission model is **not bound** to the routes (which are unauthenticated) |
| **C. Live automation readiness**                                    | **12 / 100** | Correctly near-zero by design: `sendLive` always throws, no connector, no consent/legal/monitoring/rollback/founder sign-off; only the _gating scaffold_ exists                                                                  |
| **D. Demo / investor readiness**                                    | **82 / 100** | Two visible routes that **build and render**, one deterministic PII-safe end-to-end run, a code-computed parity scorecard, honest banners, 829 green tests — strong; held below 90 by no deployed URL and no live proof          |

**Headline verdict: 90 is NOT claimed on any axis.** The mock/dry-run **capability** axis is a
credible **85**; **live automation readiness is 12** and must stay low until external sign-offs exist.
The earlier in-route self-computed "100/100" (PR #160) is a _checklist-breadth_ metric over what one
screen renders — it is real but narrower than full implementation parity, so this audit reconciles it
down to **85** for the capability axis to account for depth gaps (persistence, real connectors,
enforcement binding) that the checklist does not measure.

---

## 2. Final evidence table — capability → evidence → status → score impact

| Capability (lane)                                                                                                                                                        | Evidence file / test                                                                                                                                        | Status                    | Score impact                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| **B1 · Assembly island** (closer run + workspace attribution + proof trace + ordered timeline + no-egress attestation)                                                   | `packages/agents/src/gtm-os/assembly/{index,guards,timeline}.ts`; `assembly.test.ts` (**14 tests**); web `lib/gtmOsAssemblyViewModel.ts` (`.test.ts` **6**) | MOCK ✅                   | +A, +D                                      |
| **B2 · Dry-run channel engine** (email/sms/whatsapp/call/linkedin/ad/crm)                                                                                                | `packages/agents/src/channels/dryRunChannels.ts` (`.test.ts` **11**), `channelPolicy.ts` (`.test.ts` **11**)                                                | DRY-RUN ✅ `sent:false`   | +A; +C scaffold only                        |
| `planDryRunAction` always `{mode:'dry_run', sent:false}`; `sendLive` always throws                                                                                       | `dryRunChannels.ts:91-92`, `:144` (returns `never`)                                                                                                         | SAFE ✅                   | keeps C low (correct)                       |
| **B3 · CRM-lite + timeline** (in-memory Contact/Company/Opportunity, idempotent upsert, `assertNoRawPii` on every write)                                                 | `packages/agents/src/crm-lite/mockCrmLite.ts` (`.test.ts` **12**), `timeline.ts` (`.test.ts` **8**)                                                         | MOCK ✅ in-memory         | +A; **no persistence** caps B               |
| **B4 · Audience / signal builder** (lawful fixtures, transparent 0..1 score, rejects scraped sources, drops non-`.example`/non-`555-01xx`)                               | `packages/agents/src/audience/audienceBuilder.ts` (`.test.ts` **13**), `signalScoring.ts` (`.test.ts` **6**)                                                | SANDBOX ✅                | +A; licensed providers PLANNED caps B       |
| **B5 · TrustOps analytics** (funnel + transparent 0–100 trust score 40/25/25/10, mock report, no-egress attestation)                                                     | `packages/agents/src/trustops/metrics.ts` (`.test.ts` **16**), `report.ts` (`.test.ts` **7**)                                                               | MOCK ✅                   | +A, +D                                      |
| **B6 · Enterprise release gates** (3 stages; `controlled_live` requires **7** sign-offs; fail closed on empty/unknown)                                                   | `packages/agents/src/security/releaseGate.ts` (`.test.ts` **14**); `permissionModel.ts` (`.test.ts` **13**)                                                 | SAFE ✅ fail-closed       | +B; keeps C honest                          |
| `controlled_live` = signedCustomerScope + counselSignoff + founderSignoff + monitoring + rollback + secrets + connectorApproval                                          | `releaseGate.ts:63-72` (`STAGE_REQUIREMENTS`)                                                                                                               | ✅ all 7 enumerated       | maps to every "live readiness" precondition |
| **Integration packet** (one unified `IntegratedRunPacket` calling the **real** B1–B6 modules; build-time `assertSendLiveFailsClosed` + `assertIntegratedPacketNoRawPii`) | `packages/agents/src/gtm-os/integration/{runPacket,adapters}.ts`; `runPacket.test.ts` (**8**)                                                               | MOCK ✅                   | +A, +D (reconciled from PR #159)            |
| **Visible route — GTM Command Center** (8 panels + code-computed parity scorecard, persistent MOCK banner, no send controls)                                             | `apps/web/src/app/gtm-command-center/page.tsx`; `lib/gtmCommandCenterViewModel.ts` (`.test.ts` **30**); `page.smoke.test.tsx` (**5**)                       | MOCK ✅ **builds**        | +D (reconciled from PR #160)                |
| **Visible route — Integrated demo** (async server component running **real** `@cognitia/agents` via server-only adapter)                                                 | `apps/web/src/app/gtm-os-integrated-demo/page.tsx`; `lib/server/gtmIntegratedDemoData.ts` (`.test.ts` **9**)                                                | MOCK ✅ **builds**        | +A, +D                                      |
| **Production build proven** (was a documented blocker)                                                                                                                   | `next build` → 22 routes incl. both GTM routes; `next.config.mjs` `transpilePackages` + `extensionAlias`                                                    | ✅ **resolved this pass** | +A, +D, +B                                  |
| No-live-egress / no-raw-PII (system-wide)                                                                                                                                | safety scans §0; source-scan tests inside B2/integration                                                                                                    | ✅                        | keeps C low (correct)                       |

---

## 3. Exact remaining blockers (what stands between today and a higher score)

### Caps **A (implementation parity)** below 90 — mock-safe, in-scope-next (no forbidden deps)

1. **No persistence.** CRM-lite, timeline, and proofs are in-memory per request; the TrustOps funnel
   runs over a fixed 3-run scenario, not stored runs (`crm-lite/mockCrmLite.ts`, `trustops/metrics.ts`).
   → wire `@cognitia/db`.
2. **Two view-model truths.** `apps/web/src/lib/gtmCommandCenterViewModel.ts` (PR #160) _mirrors_ lane
   semantics through `@cognitia/core`, while `gtmIntegratedDemoData.ts` (PR #158) calls the real
   `@cognitia/agents`. Converging the Command Center onto the real modules would remove the mirror
   caveat. (Both are tested; this is depth, not a bug.)
3. **Real connectors are PLANNED.** CRM-lite does not implement a `CrmPort`; audience does not consume
   a licensed data provider. Documented PLANNED in `docs/sales-closer/`.

### Caps **B (enterprise readiness)** below ~60

4. **Routes are unauthenticated** and the B6 permission model is **not bound** to route access or the
   approval path (`grep` confirms no `auth`/`session` in either page). → bind `permissionModel.ts`.
5. **No deployed/reachable environment; no observability, monitoring, or rollback wired.** Verified as
   build + tests, not a running URL with telemetry.

### Caps **C (live automation readiness)** — forbidden in any overnight lane (require external sign-off)

6. Legal/counsel sign-off; signed customer scope; consent records.
7. Live connector approvals; CRM credentials; channel/vendor approvals.
8. Monitoring + rollback recorded; founder approval.
9. Any live email/SMS/WhatsApp/call/LinkedIn/ad — `controlled_live` stays closed until all **7**
   conditions in `releaseGate.ts:63-72` are recorded. **This is intended and must not be bypassed.**

### Caps **D (demo readiness)** below 90

10. No deployed URL (build proven locally, not hosted). No screenshots/recording artifact committed.

---

## 4. Score deltas vs prior audits (reconciled)

| Axis                  | `alta-80-readiness-evidence.md` (PR #158) | `alta-80-command-center-evidence.md` (PR #160) | **This audit** | Why it moved                                                          |
| --------------------- | ----------------------------------------- | ---------------------------------------------- | -------------- | --------------------------------------------------------------------- |
| Implementation parity | ~68–74 (real-module wiring)               | 100/100 _checklist breadth_                    | **85**         | reconciles checklist breadth with depth gaps; +`next build` proven    |
| Enterprise readiness  | low (not scored as a number)              | not scored                                     | **48**         | gates/guards real; no persistence/auth-binding/deploy                 |
| Live automation       | ~22 (must stay low)                       | unchanged                                      | **12**         | re-grounded to capability that actually exists (gating scaffold only) |
| Demo / investor       | implicit                                  | strong                                         | **82**         | two routes now **build**; deterministic run + scorecard + green tests |

---

## 5. Acceptance check

- ✅ Honest score — 90 is **not** claimed on any axis; capability (85) and live readiness (12) are
  reported separately.
- ✅ No fake live or customer claims — every capability labelled MOCK/SANDBOX/DRY-RUN; live path
  proven fail-closed.
- ✅ Every score cites a file, test, or command result (§0–§3), not vibes.
- ✅ Remaining blockers enumerated exactly and classified by what unblocks them (§3).

PRs #158 / #159 / #160 remain **draft**. No merge, undraft, retarget, close, or state change is made
by this audit. Going live remains blocked by construction behind the 7-sign-off `controlled_live` gate.
