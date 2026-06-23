# Cognitia / Demandara — Final System-State & Execution Map

> Single evidence-backed reconciliation of every recent Claude session, Codex
> audit, open PR, remote branch, and strategy document into one system-state
> report. Hostile-grade, no inflated scores. Every line is tagged `[LOCAL]`
> (command run this session), `[READ]` (direct repo read this session),
> `[CLAIM]` (asserted by a doc/PR/session, not independently verified here), or
> `[MISSING]` (artifact not found).

---

## 1. Timestamp & provenance

- **Generated:** 2026-06-22 20:13 PDT (America/Vancouver) `[LOCAL]`
- **Canonical line:** `origin/overnight/gtm-implementation` `[READ]`
- **Canonical overnight SHA:** `da48e8f1beeb2709591e7951d49fa3a893cb4d47` (`da48e8f`) `[LOCAL]`
- **`main` SHA:** `d3d198e75fe5b7b0b7cff61590e267fed200d3d7` `[LOCAL]`
- **Audit branch:** `claude/cognitia-demandara-audit-0pupj6` (this report only; based on overnight) `[LOCAL]`
- **Auditor:** execution-controller audit session, read-only against canonical; no product code changed.

### 2. Canonical SHA (restated for citation)

`da48e8f` — `Merge PR #179: pure automation release-gate engine (Sales Closer, mock-safe)`. Overnight has **164 commits** total `[LOCAL]`.

---

## 3. Executive verdict

Cognitia is a **real, production-shaped, mock-safe monorepo** — not vaporware and
not a Hermes-only shell. The canonical `overnight/gtm-implementation` line builds
clean, types clean, and passes **805 tests across 106 files**, all verified locally
this session `[LOCAL]`. The web app builds **21 static routes** `[LOCAL]`. The
governance core (approval gating, RLS tenant isolation, idempotency, audit ledger,
kill-switch, PII redaction, no-token doctrine) is **verified-in-code-and-tests**,
not just claimed.

The honest ceiling is equally clear:

- **The product is not deployed.** There is no reachable environment, no live CRM
  round-trip, no managed-Postgres RLS proof, no SOC 2, no signed pilot tenant.
- **All outreach is simulation/dry-run only.** No live send path exists; this is by
  design and is enforced (`sendLive()` throws; `controlled_live` gate fails closed).
- **The repo is operationally messy.** **111 open PRs** (110 draft + 1 non-draft),
  **204 remote branches**, default branch is `main` (which is _behind_ canonical),
  no branch protection, no SAST/dependency-scan/coverage gates in CI, and no
  `AGENTS.md`/`CLAUDE.md`. This is the single biggest drag on velocity and trust.

**Verdict by purpose:**

- **Investor/diligence demo:** strong (mock-safe, evidenced, honest). **~78/100.**
- **First paid pilot (Tenant Zero / Demandara):** product-ready, deploy-blocked.
  **~40/100** until a reachable env + one live CRM round-trip + a signed scope exist.
- **Actual-live autonomous outreach:** **capped at ~22/100 by design** — blocked on
  legal/counsel sign-off, signed customer scope, connector approvals, and deployment
  controls that are explicitly absent. This cannot and should not be 100 today.

**Three biggest corrections to stale claims** (detail in §4–§7):

1. `/gtm-command-center` is **NOT** canonical. It exists only on PR branches
   (#193, #190, #189, #186, #168, #161, #160). The canonical GTM surface is
   `/gtm-os-integrated-demo`. `[LOCAL]` `[READ]`
2. **Agent Economy is NOT blank** in canonical. Work orders, escrow, marketplace,
   and disputes are real, tested TypeScript (`apps/api/src/agentEconomy.ts`,
   `marketplace.ts`, `packages/core/src/schemas/economy.ts`). It is simulation-locked
   and internal-credits-only. `[READ]`
3. The **805 tests / 106 files** figure (previously a `[CLAIM]` from #196/#197) is
   now **verified `[LOCAL]`**. An older "292 tests" figure in a security doc is stale.

---

## 4. What is built and canonical (on `overnight` @ `da48e8f`)

All items `[READ]`/`[LOCAL]` unless noted.

**Platform & build**

- pnpm monorepo: `apps/{api,web,worker}`, `packages/{agents,core,db,evals,integrations,workflows}`. `[READ]`
- `pnpm install --frozen-lockfile` → OK (8.4s). `pnpm check` → **805 tests / 106 files**, prettier + typecheck clean. `pnpm --filter @cognitia/web build` → **21 static pages**. `[LOCAL]`

**GTM / Sales Closer spine (mock-safe, real modules)**

- Sales Closer workflow state machine: `packages/agents/src/closer/salesCloserWorkflow.ts` — lead intake → compliance doctrine → mandatory human approval → appointment → CRM-lite writeback → proof report. Tested. `[READ]`
- GTM-OS assembly B1–B6: `packages/agents/src/gtm-os/assembly/` — composes one lead through mock ports, PII-safe projection, no-egress attestation (`guards.ts`). `[READ]`
- Dry-run channels: `packages/agents/src/channels/dryRunChannels.ts` — always `{mode:'dry_run', sent:false}`; `sendLive()` throws. `[READ]`
- Audience/signal scoring, CRM-lite (in-memory), Mira proposal agent (`mira/mira.ts`, email fenced off). `[READ]`

**Trust primitives (COG-003/004/005/008)**

- Append-only Proof Registry (`apps/api/src/proofs.ts`), evidence tags `verified_fact|likely_inference|unknown`, redaction-gated public projection. `[READ]`
- Agent Trust Credentials (ATC), SkillProof, verified-fact-gated reputation. `[READ]`

**Release gates & approval (two distinct gates)**

- Automation release gate (PR #179, merged): `packages/agents/src/closer/automationReleaseGate.ts` — pure 12-condition fail-closed decision (`blocked` / `ready_for_dry_run` / `controlled_live_authorized`). **Not yet wired to any route** — it is a decision model. `[READ]`
- Stage release gate: `packages/agents/src/security/releaseGate.ts` — `dry_run|private_pilot|controlled_live`, controlled_live requires 7 conditions, fail-closed. `[READ]`
- Approval queue: API routes `/agent-actions/*` (`apps/api/src/handlers.ts`) + web view-model `apps/web/src/lib/approvalQueue.ts` wired to `/approvals` route. **Approval queue UI + API are already canonical** (CRM-write scope). `[READ]`

**Agent Economy (simulation-locked, internal credits only)**

- `apps/api/src/agentEconomy.ts`, `agentEconomyActions.ts`, `marketplace.ts`; schemas `packages/core/src/schemas/economy.ts`. Work-order lifecycle, escrow released only on `verified_fact`, disputes (release/refund/split), internal marketplace with tier-aware matching, `visibility='internal'` lock. Tests: `agentEconomy.test.ts`, `agentEconomyAgentActions.test.ts`, `marketplace.test.ts`, `economySmoke.live.test.ts`. `[READ]`

**Security / tenancy / kill-switch**

- RLS + `SET LOCAL` transaction-scoped tenant context (`packages/db/src/client.ts`), verified under non-superuser `app_user` on PGlite (`packages/db/src/kysely.rls.pglite.test.ts`). `[READ]`
- Session-derived auth (forged `x-tenant-id` rejected), RBAC, kill-switch pause/resume (`apps/api/src/killSwitch.ts`), AES-256-GCM secret store, HubSpot webhook signature verification. `[READ]`
- No-token doctrine guard: no public token/coin/staking surface or pre-launch sale route; no `did:cognitia`. `[READ]`

**Canonical web routes (21 pages built)** `[LOCAL]`

`/`, `/agent-economy`, `/agents`, `/agents/[id]`, `/approvals`, `/cognitia`,
`/cognitia/crypto-readiness`, `/credits`, `/discovery`, `/gtm-os-integrated-demo`,
`/moveros/front-desk`, `/portal/agent-economy`, `/portal/proof`, `/portal/settings`,
`/portal/settings/data-sources`, `/proofs`, `/skills`, `/trust`, `/trust/live`,
`/_not-found` (+ dynamic `/agents/[id]`).

**Canonical docs** (`docs/`): architecture, data-model, event-taxonomy,
agent-contracts, CODEX_HANDOFF, AltaSpec_v2.yaml; `docs/cognitia/` (architecture
lock, command book, tenant map, audits booklet, agent-economy designs, pilots);
`docs/security/*`, `docs/sales-closer/*`, `docs/strategy/*`, `docs/competitive/*`,
`docs/compliance/*`, `docs/launch/*`, `docs/runbooks/*`. `[READ]`

---

## 5. What is built but branch-only (NOT on canonical)

All `[CLAIM]` from PR bodies/branch names + `[READ]` of canonical absence.

- **`/gtm-command-center` route** — multiple competing implementations on branches;
  none merged. PRs #193, #190, #189, #186, #168, #167, #161, #160, #159; branches
  `gtm-command-center-*`, `alta-80-command-center-83if82`. Canonical has no such route. `[READ]`
- **Automation-readiness panel on Command Center** — #178, #192, #190 (stacked on
  non-overnight bases). `[CLAIM]`
- **Approval-queue server read-model rebuilds** — #177, #187, #191 (rebases of #177).
  Note: a web approval-queue view-model already exists canonically; these add a
  server-side read-model. `[CLAIM]`
- **Automation-readiness e2e test matrix** — #180 / #184. `[CLAIM]`
- **Automation monitoring readiness** — #182. `[CLAIM]`
- **Deeper Agent Economy lab** (002 dispute / 003 actions / 004 marketplace-matching
  / 005 settlement / sandbox) — branches `agent-economy-00x-*`, PRs #54, #111, #195.
  Some of this (disputes, marketplace, actions) already landed canonically via the
  overnight line; the remaining 005 cross-tenant settlement is design-only. `[CLAIM]`
- **Enterprise-readiness** controls/infra/plan — #162, #185, #198, branches
  `enterprise-readiness-*`, `w7-enterprise-hardening`. `[CLAIM]`
- **Loop / goal-loop harness & agent-loop OS instructions** — #194, #105, #100, #102. `[CLAIM]`
- **Older `main`-targeted GTM/Client-Zero/Sales-Closer stack** — #44/#45/#46/#78/#79/#86
  and the #99–#149 cluster. Much is superseded by the overnight line. `[CLAIM]`

---

## 6. What is docs-only / strategy-only (not proof)

`[READ]`. These are valuable but must be marked **strategy, not proof**:

- `docs/strategy/beat-alta-10x.md`, `docs/strategy/next-phase-2026-06.md` — the
  "nobody ships this" moat thesis. The five "must-ship" moats it names (decision
  reasons, CRM provenance, eval gate, trust metrics, suppression) ARE code-backed;
  the **superiority/white-space claims about competitors are external-research
  claims**, not verified here.
- `docs/competitive/operating-plan.md` — scope fences and publishable-claim list.
- `docs/cognitia/agent-economy/*` (LAB, MARKETPLACE, DISPUTE_RESOLUTION,
  ESCROW_SIMULATION, CROSS_TENANT_SETTLEMENT_DESIGN, AGENT_DRIVEN_WORKFLOW,
  WORK_ORDER_MODEL) — escrow/disputes/marketplace are partly **built**; cross-tenant
  settlement (AGENT-ECONOMY-005) is **design-only**.
- `docs/cognitia/audits/AUDIT_BOOKLET_001/*` — prior self-grades (0–5 scale) and
  feature ledgers. Internally consistent; older test counts (525/80) are superseded
  by the current 805/106.
- `docs/security/soc-readiness-package-2026-06.md`, `hardening-package-2026-06.md`,
  `live-release-gates.md` — SOC 2 / hardening **plans**; deployment evidence absent.
- `docs/launch/*` (go-live, alpha checklist, operator handoff, rollout record) —
  launch **procedures**; not executed against a live environment.
- **Externally-named strategy PDFs** (Master Playbook Audit, Cognitia Republic
  Master Playbook v1/v2, Doctor Strange Roadmap, War Council Stress Test, Trust From
  Zero 90-Day Plan, No-token growth playbook, Alta-vs-SalesCloser report,
  compliance/proof control-plane strategy, lawful anti-copy strategy) — **`[MISSING]`
  as repo files**; the closest in-repo equivalents are the strategy/competitive/audit
  docs above plus PR #89's `business-strategy/2026-06-18_investor_audit_and_wedge_strategy.md`
  (branch-only). Treat the PDFs as external strategy inputs, not repo proof.

---

## 7. What is missing (gaps to close)

`[READ]`/`[LOCAL]`/`[MISSING]`:

- **Deployment:** no reachable environment, no `next build` deploy target wired in
  CI for `@cognitia/agents` transpile in canonical, no observability/rollback live. `[CLAIM]`/`[MISSING]`
- **Live CRM round-trip:** never executed end-to-end (HubSpot adapter exists, creds absent). `[MISSING]`
- **Managed-Postgres RLS proof:** verified only on PGlite/local PG16; Supabase/pgBouncer pooled isolation unverified. `[READ]`
- **`/gtm-command-center` in canonical.** `[READ]`
- **Automation release gate wired to the approval flow** (currently a pure model). `[READ]`
- **Trunk hygiene:** branch protection, required checks, `AGENTS.md`/`CLAUDE.md`,
  PR backlog burn-down, default-branch correction. `[READ]`/`[MISSING]`
- **CI depth:** no dependency scan, no SAST, no coverage floor (`.github/workflows/ci.yml` runs install→format→typecheck→test only). `[READ]`
- **Enterprise:** SSO/SAML, audit export, SOC 2 Type 1, data-retention/deletion. `[CLAIM]`
- **Pilot:** a signed tenant; counsel sign-off; connector approvals. `[MISSING]`

---

## 8. PR / branch ledger

**Totals (live this session):** **111 open PRs** (page 1: #90–198 = 100; page 2:
#89, 88, 86, 79, 78, 61, 54, 46, 45, 44, 3 = 11). **110 are draft; only #89 is
non-draft.** **204 remote branches.** `[LOCAL]` (Codex's "104 open / 197 branches"
was a slightly earlier snapshot; current is higher.)

> Mergeability/CI not individually re-fetched per PR (would be 111 calls); base/head/
> draft/updated are verbatim `[LOCAL]`. CI status is `[CLAIM]` from PR bodies.

### 8a. Priority PRs (verbatim base ← head, all draft)

| PR   | Base ← Head                                                                | What it adds                                   | Classification                                       |
| ---- | -------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| #159 | overnight ← `alta-80-integration-hardening-gsn8a4`                         | unified mock run packet B1–B6                  | superseded by overnight line                         |
| #160 | overnight ← `alta-80-command-center-83if82`                                | `/gtm-command-center` over B1–B6               | branch-only (CC variant)                             |
| #177 | overnight ← `approval-queue-read-model-0q1obw`                             | approval-queue **server** read-model           | branch-only (web VM already canonical)               |
| #178 | `alta-90-readiness-audit-lp6jr7` ← `gtm-automation-readiness-panel-xmp4iu` | readiness panel on CC                          | branch-only, **stacked** (not on overnight)          |
| #180 | overnight ← `automation-readiness-tests-yzbkb4`                            | e2e readiness test matrix                      | branch-only; depends on #177 if asserting real queue |
| #181 | `alta-90-readiness-audit-lp6jr7` ← `automation-readiness-audit-8q32n9`     | live-automation 80 readiness audit             | branch-only, **stacked**, report-only                |
| #182 | overnight ← `automation-monitoring-readiness-qpkmpz`                       | monitoring readiness (closer)                  | branch-only                                          |
| #186 | overnight ← `reconcile-159-160-canonical-vfi4kj`                           | reconcile #159+#160 into canonical             | branch-only (CC consolidation)                       |
| #189 | overnight ← `gtm-implementation-consolidate-r21oqk`                        | consolidate #159+#160 CC over real packet      | branch-only (CC consolidation)                       |
| #190 | overnight ← `gtm-command-center-investor-xztes9`                           | investor readiness panel on CC                 | branch-only                                          |
| #192 | `gtm-command-center-adapter-tos19e` ← `automation-readiness-panel-7xadm1`  | readiness panel on real-module CC              | branch-only, **stacked**                             |
| #193 | overnight ← `gtm-command-center-adapter-lyezt2`                            | **bring `/gtm-command-center` into canonical** | branch-only (the canonicalizing PR)                  |
| #196 | overnight ← `cognitia-hostile-audit-c3ry85`                                | hostile diligence score audit                  | branch-only, report-only                             |
| #197 | overnight ← `cognitia-demandara-master-report-t89yho`                      | master execution report + PDF                  | branch-only, report-only                             |
| #198 | overnight ← `enterprise-readiness-plan-e77v44`                             | enterprise scorecard + CI gate docs            | branch-only, docs                                    |

### 8b. Notable older / other PRs

- **#89** (non-draft, base `main` ← `business-plan-audit-rz5k5d`): investor-grade
  strategy audit; **its branch is Hermes-only** (the doc itself notes the codebase
  "is not in this repo" on that branch). Wrong-base/strategy noise relative to canonical. `[READ]`
- **#88** SESSION_AUDIT.md (base main): historical session ledger — "~90 branches →
  87 PRs: 69 merged · 9 open · 9 closed" as of 2026-06-16. `[CLAIM]`
- **#3** (base `claude/ep002-mission-run-pPoba` = the old Hermes-only line @ `0dfb0ad`):
  the original Phase-0 + Mira MVP. Foundational, long superseded. `[READ]`
- **#44/#45/#46/#78/#79/#86** and the **#99–#149** cluster: older `main`/stacked
  GTM, Client-Zero, Sales-Closer, agent-economy work — largely **superseded** by the
  overnight line; several are stacked on `claude/*` bases (parked). `[CLAIM]`

### 8c. Classification summary

- **Canonical (merged):** #179, #183 (+ the overnight history). `[LOCAL]`
- **Branch-only, active CC cluster:** #159, #160, #161, #167, #168, #186, #189, #190, #192, #193. Heavily duplicated — **needs consolidation to one.**
- **Branch-only, readiness/monitoring:** #177, #178, #180, #181, #182, #184, #187, #191.
- **Report-only:** #181, #196, #197, #198, #188, #195 (+ this report).
- **Stacked (base not overnight):** #178, #181, #185, #192 — risk of merging the wrong base.
- **Superseded / parked / older-main:** #3, #44–#46, #54, #78, #79, #86, #99–#157 cluster.
- **Wrong-repo/Hermes-noise:** #89 (non-draft, hermes-only branch), #61 (Hermes bridge fix).

---

## 9. Test / build ledger `[LOCAL]`

| Command                                          | Result                  | Evidence                                                                     |
| ------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                 | ✅ exit 0 (8.4s)        | ignored build scripts: esbuild, sharp (expected)                             |
| `pnpm check` (format:check + typecheck + vitest) | ✅ exit 0               | **Test Files 106 passed (106); Tests 805 passed (805)**; duration 48.28s     |
| `pnpm --filter @cognitia/web run build`          | ✅ exit 0               | Compiled OK; **Generating static pages (21/21)**; 21-route table             |
| CI definition (`.github/workflows/ci.yml`)       | runs the **full** suite | install → format:check → typecheck → `pnpm run test` (no SAST/scan/coverage) |

Targeted suites all included in the green run (paths for citation): closer
(`automationReleaseGate.test.ts`, `salesCloserWorkflow.test.ts`), security
(`releaseGate.test.ts`, `kysely.rls.pglite.test.ts`), trust (11 files incl.
`trustPacket.test.ts`, `publicTrustFeed*.test.ts`), economy (`agentEconomy*.test.ts`,
`marketplace.test.ts`), approval (`approvalQueue.test.ts`), compliance
(`compliance.test.ts`), kill-switch (`killSwitch.test.ts`). `[READ]`

**Correction:** the "292 tests" figure in `docs/security/*` is **stale**; the
canonical suite is **805/106** `[LOCAL]`. Branch-level counts cited in audit docs
(771/103, 786/105) are older overnight snapshots `[CLAIM]`.

---

## 10. Security / vulnerability posture

`[READ]` unless noted. Detail derived from canonical code + `SECURITY.md` + `docs/security/*`.

**Verified-in-code-and-tests (fail-closed):**

- Tenant isolation: RLS forced + transaction-scoped `SET LOCAL` (no pooled-connection
  leakage in-process), non-superuser `app_user` proven on PGlite. `[READ]`
- Session-derived auth (HMAC, timing-safe), forged `x-tenant-id` rejected; RBAC
  (viewer/operator/approver/admin), owner-only kill-switch resume. `[READ]`
- Idempotency on external writes; mandatory human approval before any side effect;
  append-only audit ledger (9-entry lifecycle proven). `[READ]`
- Secrets: AES-256-GCM secret store, tokens never logged, `.env` git-ignored,
  HubSpot webhook signature verification with replay window. `[READ]`
- No-token/no-investment doctrine guard enforced in tests. `[READ]`
- No critical code-level vulns found on read (no unguarded outbound, no missing auth
  on sensitive routes, timing-safe comparisons). `[READ]`

**Gaps (deployment/process, not code defects):**

- Managed-Postgres / pgBouncer RLS unverified (risk R-2). `[READ]`
- KMS data key, TLS, backups/PITR unprovisioned; no live CRM round-trip. `[CLAIM]`
- No branch protection; CI lacks dependency scan / SAST / coverage floor. `[READ]`
- IR drill and restore drill documented but never executed. `[CLAIM]`
- Data retention/deletion policy not implemented. `[CLAIM]`

**Honest claim ladder:** "CI-proven governance core, Alpha" = TRUE. "Hardened core",
"SOC 2 Type 1 ready", "SOC 2 Type 2" = NOT YET. `[READ]`

---

## 11. Product UX — how it will be used (A→Z)

`[READ]` of canonical routes + workflow code.

1. **Operator entry:** operator signs in (session-derived tenant+role; browser never
   sends role). Lands on `/cognitia` command overview.
2. **Lead intake:** a lead is normalized (`normalizeGtmProspect`) — raw PII dropped,
   email/phone stored as hashes only.
3. **Consent/compliance gate:** `evaluateComplianceDoctrine` / `canContactProspect`
   blocks unsubscribed/DNC/withdrawn; `manual_review_required` is the default basis.
4. **Dry-run channel plan:** `planDryRunAction` produces an inspectable plan with
   `sent:false`; live send is structurally impossible (`sendLive()` throws).
5. **Approval queue:** `/approvals` lists proposed actions (channel, risk, evidence
   count); operator approves/rejects with a **mandatory structured reason code**.
   Execute-before-approve returns 409.
6. **Release gate:** stage gate (`dry_run|private_pilot|controlled_live`) and the
   automation gate (12 conditions) both fail closed; controlled-live stays locked.
7. **Proof ledger:** every action emits append-only, evidence-tagged proofs
   (`/proofs`); corrections via `supersedes_proof_id`, never edits.
8. **Command Center:** today this is `/gtm-os-integrated-demo` (B1–B6 over real
   modules, mock-safe) + `/cognitia`. (`/gtm-command-center` is branch-only.)
9. **Sales Closer flow:** intake → compliance → approval → appointment → CRM-lite
   writeback → proof report → `completed` (or a `blocked_*` terminal state).
10. **Agent Economy loop (internal, simulated):** agent requests work → ATC-gated
    accept → simulated delivery + proof → verify/reject/dispute → escrow released
    only on `verified_fact`; internal credits only.
11. **Enterprise buyer package:** exportable trust packet (metrics + decision/audit
    history + control attestations); `/trust` (static researcher view) and
    `/trust/live` (rate-limited public feed, empty by default).
12. **Trust center / proof receipts:** public-safe proof projections gated by
    redaction checks; default `public_safe=false`.
13. **No-token growth loop:** credits-only accounting; wallet bindings inert; all
    token gates NOT PASSED; growth via trust/proof transparency, not token incentives.

---

## 12. Feature inventory (canonical)

`[READ]`. C = canonical, B = branch-only, D = design/docs-only.

| Area           | Feature                                                    | State                   |
| -------------- | ---------------------------------------------------------- | ----------------------- |
| GTM spine      | Sales Closer workflow (7 happy + 6 blocked states)         | C                       |
| GTM spine      | GTM-OS B1–B6 assembly, no-egress + PII guards              | C                       |
| GTM spine      | Dry-run channels (`sent:false`, live disabled)             | C                       |
| GTM spine      | Audience/signal scoring, CRM-lite, Mira proposer           | C                       |
| Command Center | `/gtm-os-integrated-demo` (real modules)                   | C                       |
| Command Center | `/gtm-command-center` route                                | B (#193 et al.)         |
| Approval       | `/approvals` UI + `/agent-actions/*` API + reason codes    | C                       |
| Release gates  | automation gate (#179)                                     | C (not route-wired)     |
| Release gates  | stage gate (dry/pilot/controlled-live)                     | C                       |
| Trust          | Proof Registry, ATC, SkillProof, reputation                | C                       |
| Trust          | `/trust`, `/trust/live`, exportable trust packet           | C                       |
| Agent Economy  | work orders, escrow, disputes, marketplace                 | C (sim-locked)          |
| Agent Economy  | cross-tenant settlement (005)                              | D                       |
| Security       | RLS, session auth, RBAC, kill-switch, secrets, webhook sig | C                       |
| Credits        | internal credits ledger, inert wallet placeholders         | C                       |
| Enterprise     | SSO/SAML, audit export, SOC 2                              | D (B in #162/#185/#198) |
| MoverOS        | AI front desk / lead rescue (`/moveros/front-desk`)        | C (sim)                 |

---

## 13. Agent Economy inventory

`[READ]`.

**Canonical, real, tested (simulation-locked, internal credits only):**

- Work-order lifecycle: proposed→accepted→in_progress→delivered→verified/rejected/
  disputed/canceled (`apps/api/src/agentEconomy.ts`; schemas `economy.ts`; migration 0016).
- Escrow: reserved at accept, **released only on `verified_fact` proof** (DB trigger +
  service + zod literal `simulation:true`).
- Disputes (002): owner arbitration release/refund/split (migration 0017).
- Agent-action proposals into the economy (`agentEconomyActions.ts`).
- Internal marketplace (004): `visibility='internal'` lock, tier-aware matching,
  yanked-skill/inactive-ATC suppression (`marketplace.ts`; migration 0018).
- Agent Fabric Lab nodes (019): registry + route-decision + quarantine kill-switch +
  simulated execution receipts; **containment guard** fails build on
  child_process/net/http/ssh2 import. `[CLAIM]` (per audit booklet; code present).

**Branch-only / design-only:** cross-tenant settlement (005, design), additional
lab branches (`agent-economy-001..005`, sandbox, gap-report #195).

**Hard boundaries (enforced):** no token, no DEX/liquidity/staking, no real payments,
no on-chain, no production deploy, no price/return language.

**Correction:** the "Agent Economy is blank" claim is **false** for canonical;
the "real unmerged TS on agent-economy branches" Codex claim is **also true** —
both can hold because canonical has the core and branches have extensions.

---

## 14. Alta / SalesCloser comparison

`[READ]` (code) + `[CLAIM]` (competitive docs; external claims not independently verified).

| Dimension                                      | Cognitia today         | Alta / SalesCloser AI | Position                 |
| ---------------------------------------------- | ---------------------- | --------------------- | ------------------------ |
| Per-action human approval + reason codes       | ✅ shipped, role-gated | partial / opaque      | **ahead (code-backed)**  |
| CRM write provenance (stamped properties)      | ✅ shipped             | rare                  | **ahead**                |
| Eval gate before behavior change               | ✅ golden gate in CI   | uncommon              | **ahead**                |
| Tenant isolation provable (RLS test in CI)     | ✅ (local), ⛔ managed | varies                | **parity/ahead (local)** |
| Live outreach (email/SMS/voice/LinkedIn)       | ❌ none (by design)    | ✅ core product       | **behind**               |
| Deployed multi-tenant SaaS, real customers     | ❌ not deployed        | ✅                    | **behind**               |
| Autonomy / earned tiers                        | ❌ design-only         | ✅ (varying)          | **behind**               |
| Trust/proof moat (receipts, exportable packet) | ✅ shipped             | ❌                    | **ahead (white space)**  |

**Honest read:** Cognitia is **behind on the thing buyers pay for today** (live,
deployed outreach) and **ahead on accountability/trust** (which is its wedge). To
_claim_ superiority it must ship: (1) a reachable deployment, (2) one live CRM
round-trip, (3) at least one governed live channel under counsel sign-off, (4) a
named pilot with real outcomes. **Reject any surface-only 100** — superiority is
not earned until live, accountable outreach exists with a real customer.

---

## 15. Enterprise readiness map

`[READ]`/`[CLAIM]`.

| Gate                                | Status        | Blocker                           |
| ----------------------------------- | ------------- | --------------------------------- |
| Governed lifecycle + audit trail    | ✅ code       | —                                 |
| Tenant isolation (managed Postgres) | 🟡 local only | hosted RLS / pgBouncer proof      |
| Secrets (KMS), TLS, backups/PITR    | 🔴            | provisioning                      |
| Branch protection / change mgmt     | 🔴            | enable rulesets                   |
| CI depth (SAST/scan/coverage)       | 🔴            | add gates                         |
| SSO/SAML                            | 🔴            | not started (branch designs only) |
| Audit export + retention/deletion   | 🔴            | not started                       |
| SOC 2 Type 1                        | 🔴            | program/budget; Vanta/Drata       |
| IR + restore drills                 | 🟡            | runbooks exist, undrilled         |

---

## 16. Actual-live blockers (why actual-live ≠ 100)

`[READ]`/`[MISSING]`. Actual-live autonomous outreach is **capped ~22/100 by design**
and cannot be 100 until ALL of these are proven:

1. **Legal/counsel sign-off** on outreach + (separately) any token concept. `[MISSING]`
2. **Signed customer scope + consent records** for a real tenant. `[MISSING]`
3. **Connector/vendor approvals** (CRM/ESP/SMS) + real credentials. `[MISSING]`
4. **Deployment controls**: reachable env, monitoring, rollback, kill-switch live. `[MISSING]`
5. **Managed-Postgres RLS proof** (pgBouncer). `[READ]`
6. **One live CRM round-trip** captured as a trust packet. `[MISSING]`

The automation release gate already encodes these as required conditions and **fails
closed** — the code is honest about the cap. `[READ]`

---

## 17. Scorecard & progress bars

0–100, evidence-cited, hostile (no inflation). Bars are 20 cells.

```
Canonical assembly (build/types/tests green)   [██████████████████░░]  90/100  [LOCAL] 805/106, 21 routes
Mock / dry-run capability                       [██████████████████░░]  92/100  [READ] sendLive throws; no-egress guards
GTM / Demandara capability                      [██████████████░░░░░░]  70/100  [READ] full mock spine; not deployed
Sales Closer parity/superiority                 [████████████░░░░░░░░]  60/100  [READ] governance ahead; no live send
Alta parity                                     [██████████░░░░░░░░░░]  52/100  [READ] ahead on trust, behind on live
/gtm-command-center real-output                 [████░░░░░░░░░░░░░░░░░]  20/100  [READ] branch-only (#193); not canonical
Investor / demo readiness                       [███████████████░░░░░]  78/100  [LOCAL] reproducible, honest, mock-safe
Controlled-live code readiness                  [████████░░░░░░░░░░░░]  42/100  [READ] gates+killswitch coded; not wired live
Actual-live readiness                           [████░░░░░░░░░░░░░░░░░]  22/100  [MISSING] legal/deploy/connector/consent
Enterprise readiness                            [███████░░░░░░░░░░░░░]  38/100  [CLAIM] SSO/SOC2/export absent
Security vulnerability posture                  [███████████████░░░░░]  76/100  [READ] strong core; deploy/process gaps
Trust / proof moat                              [████████████████░░░░]  82/100  [READ] receipts, ATC, eval gate shipped
Agent Economy architecture                      [██████████████░░░░░░]  72/100  [READ] real, sim-locked; 005 design-only
Repo / trunk hygiene                            [█████░░░░░░░░░░░░░░░░]  26/100  [LOCAL] 111 PRs, 204 branches, no protection
Developer-loop maturity                         [████████████░░░░░░░░]  62/100  [LOCAL] clean check/build; weak trunk CI
First paid pilot readiness                      [████████░░░░░░░░░░░░]  40/100  [READ] product ready; deploy/scope/legal block
```

**To move each toward 95–100** (key actions): canonical assembly → add `next build`
to CI + coverage floor; command-center → merge one consolidated #193; controlled-live
→ wire automation gate to approval flow + add monitoring/rollback; enterprise → SSO +
audit export + SOC 2 program; trunk hygiene → protect branches, fix default branch,
burn PR backlog, add `AGENTS.md`/`CLAUDE.md`; actual-live stays capped until §16 clears.

---

## 18. 7-day merge/build plan

1. **Consolidate the Command Center cluster** into **one** PR onto overnight (pick
   #193 as the canonicalizer; close/supersede #159/#160/#161/#167/#168/#186/#189/#190/#192). `[CLAIM]`
2. **Decide #177** (server approval-queue read-model): merge or close; then resolve
   #180's dependency on it. `[CLAIM]`
3. **Add `next build` to CI** (with `transpilePackages: ['@cognitia/agents']`) so the
   21-route build is gated, not just typecheck/test. `[LOCAL]` basis.
4. **Wire the automation release gate** (`automationReleaseGate.ts`) into the approval
   flow as a read-only advisory (still fail-closed; no live send). `[READ]`
5. **Add `AGENTS.md` + `CLAUDE.md`** at root (contracts from `docs/CODEX_HANDOFF.md`). `[READ]`
6. **Enable branch protection** on `overnight` + required CI check; stop direct pushes. `[READ]`
7. **Triage the 111-PR backlog**: label superseded/parked, close Hermes-noise (#89,
   #61) relative to canonical. `[LOCAL]`

## 19. 30-day enterprise/pilot plan

1. Promote canonical: make `overnight` the default branch (or fast-forward `main`). `[LOCAL]`
2. Provision a reachable env: app_user role, KMS key, TLS, backups/PITR. `[CLAIM]`
3. Execute **one live HubSpot round-trip** (read → Mira propose → approve → execute →
   idempotency re-run → kill-switch drill) and export the trust packet. `[CLAIM]`
4. Verify managed-Postgres/pgBouncer RLS (close R-2). `[READ]`
5. Add CI depth: dependency scan + SAST + coverage floor. `[READ]`
6. Run one IR table-top + one restore drill; capture artifacts. `[CLAIM]`
7. Sign Tenant Zero (MoverOS) or Demandara scope + consent; begin governed pilot
   (CRM-write scope only; email fenced). `[READ]`

## 20. 90-day Agent Economy / moat plan

1. Ship per-segment scorecards (LEARN-1) + earned-autonomy tiers (TIER-1) — both
   currently design-only. `[CLAIM]`
2. Marketplace detail pages + matching-explanation panel. `[CLAIM]`
3. Cross-tenant settlement (AGENT-ECONOMY-005) — implement design behind token gates
   (still internal credits; no token). `[READ]`
4. Pursue SOC 2 Type 1; publish live trust benchmarks from real decision labels. `[CLAIM]`
5. Only after a live channel + named pilot: re-test Alta/SalesCloser superiority
   claims against real outcomes (no surface-only scoring). `[READ]`

---

## 21. Founder decisions required

1. **Default branch:** promote `overnight` (or fast-forward `main`)? Researchers/CI
   currently anchor on a behind-`main`. `[LOCAL]`
2. **Command Center canonicalization:** approve #193 as the one true `/gtm-command-center`
   and close the duplicates? `[CLAIM]`
3. **Hosted dev DB** choice (Supabase) to unblock managed-RLS proof. `[CLAIM]`
4. **Pilot tenant:** MoverOS (Tenant Zero) vs Demandara first? `[READ]`
5. **Counsel engagement** for live-outreach sign-off (and, separately, token legal). `[MISSING]`
6. **PR backlog policy:** authorize bulk close of superseded/parked PRs. `[LOCAL]`

---

## 22. "Do not do" list

- ❌ No live outreach / real sends of any kind. `sendLive()` must keep throwing.
- ❌ No vendor execution, no real CRM writes, no raw PII anywhere public.
- ❌ No token launch; no investment/return/appreciation/yield language.
- ❌ Do not claim actual-live or SOC 2 or "production-ready" without the §16/§15 proofs.
- ❌ Do not merge stacked PRs (#178/#181/#192/#185) onto the wrong base.
- ❌ Do not present `/gtm-command-center` as canonical until #193 merges.
- ❌ Do not recreate the product on the Hermes-only branch; canonical is overnight.
- ❌ Do not modify product code or alter PR state (merge/undraft/retarget/close) as
  part of this audit.

---

## 23. Appendix — evidence citations

**Commands run `[LOCAL]`:** `git fetch`/`rev-parse`/`ls-tree`/`merge-base`;
`pnpm install --frozen-lockfile`; `pnpm run check` (805/106); `pnpm --filter
@cognitia/web run build` (21 pages); GitHub MCP `list_pull_requests` (pages 1–2);
`git ls-remote --heads` (204).

**Key code paths `[READ]`:**
`packages/agents/src/closer/{salesCloserWorkflow,automationReleaseGate}.ts`;
`packages/agents/src/gtm-os/assembly/{index,guards,timeline}.ts`;
`packages/agents/src/channels/dryRunChannels.ts`;
`packages/agents/src/security/{releaseGate,permissionModel}.ts`;
`apps/api/src/{handlers,agentEconomy,agentEconomyActions,marketplace,proofs,killSwitch,auth}.ts`;
`apps/web/src/lib/approvalQueue.ts`; `apps/web/src/app/{approvals,gtm-os-integrated-demo,agent-economy,trust,trust/live,proofs}/page.tsx`;
`packages/db/src/{client.ts,kysely.rls.pglite.test.ts}`;
`packages/core/src/schemas/economy.ts`; `.github/workflows/ci.yml`; `SECURITY.md`.

**Key docs `[READ]`:** `docs/CODEX_HANDOFF.md`; `docs/strategy/{beat-alta-10x,next-phase-2026-06}.md`;
`docs/competitive/operating-plan.md`; `docs/security/*`;
`docs/cognitia/{ARCHITECTURE_LOCK_V1_1,IMPLEMENTATION_COMMAND_BOOK,TENANT_MAP}.md`;
`docs/cognitia/agent-economy/*`; `docs/cognitia/audits/AUDIT_BOOKLET_001/*`,
`docs/cognitia/audits/{V1_1_FINAL_AUDIT,alta-80-readiness-evidence,overnight-integration-plan}.md`;
`docs/launch/*`.

**PR/branch evidence `[LOCAL]`:** 111 open PRs (#3–#198), 110 draft + #89 non-draft;
204 remote branches; priority PR base/head per §8a.

**`[MISSING]` (named but not in repo):** Master_Playbook_Audit.pdf,
Cognitia_Republic_Master_Playbook(.2).pdf, Doctor_Strange_Roadmap.pdf,
War_Council_Stress_Test.pdf, cognitia-demandara-updated-progress-audit-2026-06-21,
Trust-From-Zero-90-Day-Plan, no-token playbook, Alta-vs-SalesCloser report,
compliance/proof control-plane strategy, lawful anti-copy strategy. Closest in-repo
equivalents and PR #89's branch-only investor audit are noted in §6.

**Stale claims corrected:** (a) `/gtm-command-center` canonical → it is branch-only;
(b) Agent Economy blank → it is real canonical code (sim-locked); (c) 292 tests →
805/106 `[LOCAL]`; (d) "104 open / 197 branches" → 111 open / 204 branches now.
