# Roadmap Audit — Compiled State of the Line (2026-06-23)

> Date: 2026-06-23. Base audited: `overnight/gtm-implementation` @ `da48e8f`
> (Merge PR #179, "pure automation release-gate engine"). Companion to and
> continuation of `docs/strategy/next-phase-2026-06.md` (the 2026-06-10
> current-state audit + Top-10 roadmap) and bounded by
> `docs/competitive/operating-plan.md` (the authoritative V1 scope fence).
>
> Purpose: reconcile the 2026-06-10 Top-10 roadmap against what has actually
> merged since, and compile a single status rollup of the open pull-request /
> branch line so an owner can see — in one place — what shipped, what is
> in-flight, what is blocked, and what to decide next.
>
> Confidence labels: **[code]** verified in source on base, **[tests]** verified
> by a test file on base, **[pr]** asserted by an open PR (not yet on base),
> **[docs]** doc-only, **[inferred]** needs confirmation.

---

## 0. Executive summary

1. **The 2026-06-10 Top-10 roadmap is substantially complete.** Seven of ten
   items shipped on base with tests (GOV-1, SIM-1, TRUST-2, REGR-1, UNDO-1,
   LIFE-1, LEARN-1); one is partial (SCOPE-2). **Two remain open by design:**
   CRM-2 (stage-update action) and TIER-1 (risk-tiered review) — both were gated
   on prerequisites that have only now arrived. (§2)
2. **The center of gravity has moved** from "governed single-CRM write loop" to
   a broader **Sales Closer / GTM Command Center + live-automation-readiness**
   program. The open line is **99 PRs** clustering around: (a) consolidating a
   single `/gtm-command-center` over the real modules, (b) an "Alta-80/90
   readiness" audit line, (c) a **closer automation-readiness** stack (dry-run
   ledger, controlled-live sandbox, kill-switch, consent/compliance, approval
   queue, release gate, monitoring) — all explicitly **mock-safe / dry-run-only**
   — and (d) a large Client-Zero / Sales-Closer "W1–W7" build line.
3. **Scope-fence divergence to decide.** `operating-plan.md` §0a names
   **agent-economy, credits, and "Cognitia OS"** as forbidden thesis pivots that
   must not land in base as code without explicit written re-authorization. Yet
   base now carries `apps/web/src/app/agent-economy`, `/credits`, `/skills`,
   `/proofs`, and `/agents` routes plus API + tests, each self-labeled
   "simulation-only / token posture locked / internal accounting only." This is
   real merged code outside the stated V1 fence. It is not unsafe (no payments,
   no chain, no email), but it is a **documented divergence that needs an owner
   ruling**: either re-authorize and amend the fence, or quarantine these
   surfaces off base. (§4)
4. **Throughput is high; mainline convergence is THE risk.** Base has grown from
   225 tests / 39 files (2026-06-10) to **106 test files** today, and **no open
   PR has failing CI**. But the line is dangerously fanned out and deeply
   stacked: **98 of 99 open PRs are drafts** (only #89 is non-draft), only **39
   target `main`**, and **60 are stacked on other `claude/*` branches**.
   Critically, **`overnight/gtm-implementation` is itself open PR #158, stacked
   on `claude/w1-sales-closer-core-co3yll` (#135 → main)** — so the whole
   "mainline" audited here sits **~3 levels from `main`**, and the 22 PRs that
   target it sit deeper still. A separate integration branch,
   `claude/ep002-mission-run-pPoba`, has **24 PRs** feeding it with no PR of its
   own. The single highest-leverage program is not more features — it is a
   **merge-train / convergence plan** that lands the spine onto `main` and
   collapses the duplicate Command Center / readiness-audit attempts. (§3)

---

## 1. Where the line stands today (base `da48e8f`)

**Product loop (unchanged core, now fully closed and accountable):**

```
preflight (zero writes, proven) → propose (evidence + policy) →
preview (byte-equal to the write, CI invariant) → approve (mandatory reason) →
execute (idempotent + provenance-stamped) → undo (reversible archive) →
reject path feeds the CI gate → exportable trust packet
```

**Surfaces on base (`apps/web/src/app/*/page.tsx`):** `approvals` (the real
operator page), `gtm-os-integrated-demo` (B1–B6 integrated operator demo over
real `@cognitia/agents` modules), plus `agent-economy`, `agents`, `credits`,
`discovery`, `proofs`, `skills`, `trust`, `cognitia`, and the root landing
page. **[code]**

**Packages:** `agents`, `core`, `db`, `evals`, `integrations`, `workflows`
(no `agent-economy`/`credits` package — those live as API handlers + web
routes). **[code]**

**Closer automation already on base:** deterministic channel policy plus
**dry-run channels** (`packages/agents/src/channels/channelPolicy.ts` and
`dryRunChannels.ts`, with tests), a kill-switch test surface
(`apps/api/src/killSwitch.test.ts`), and the **pure automation release-gate
engine** (PR #179, merged `da48e8f`). The remainder of the closer-automation
stack is still in open PRs (§3). **[code]**

---

## 2. Top-10 roadmap reconciliation (from `next-phase-2026-06.md` §5)

| #   | Item    | Planned                                               | Status on base `da48e8f`                                                                  | Evidence                                                                                              |
| --- | ------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | GOV-1   | Typed write preview + preview==write CI invariant     | **Shipped**                                                                               | `apps/api/src/previewAction.test.ts` **[tests]**                                                      |
| 2   | SIM-1   | Zero-write preflight on tenant data + report          | **Shipped**                                                                               | `apps/api/src/preflight.ts`, `preflight.test.ts` **[tests]**                                          |
| 3   | TRUST-2 | Exportable procurement-grade trust/audit packet       | **Shipped**                                                                               | `apps/api/src/trustPacket.ts` **[code]**                                                              |
| 4   | REGR-1  | Rejection→regression flywheel                         | **Shipped**                                                                               | `apps/api/src/regressionCandidate.test.ts`, `packages/evals/datasets/regressions-v1.json` **[tests]** |
| 5   | TIER-1  | Risk-tiered review + sampled audits (earned autonomy) | **Not built (deferred by design)** — no `riskTier` surface in code                        | grep: no `riskTier/risk_tier` refs **[code]**                                                         |
| 6   | CRM-2   | Stage-update action behind approval                   | **Not built** — Mira still proposes only `crm.task.create` / `crm.note.create`            | `packages/agents/src/mira/mira.ts:174-206` **[code]**                                                 |
| 7   | UNDO-1  | Compensators / undo window                            | **Shipped**                                                                               | `apps/api/src/rollback.test.ts` **[tests]**                                                           |
| 8   | LIFE-1  | Approval lifecycle: SLA, reminders, expiry, escalate  | **Shipped** (lifecycle acceptance surface present)                                        | `apps/api/src/lifecycle.acceptance.test.ts` **[tests]**                                               |
| 9   | LEARN-1 | Per-segment scorecards feeding targeting              | **Shipped**                                                                               | `apps/api/src/scorecards.ts`, `scorecards.test.ts` **[tests]**                                        |
| 10  | SCOPE-2 | Agent identity + field-level write-scope check        | **Partial** — fence/governance enforcement present; explicit field-level scope check thin | `apps/api/src/{fence,governance}.test.ts` **[tests]**                                                 |

**Net:** 7 shipped, 1 partial (SCOPE-2), 2 open (CRM-2, TIER-1). The two open
items are the correct next wave: TIER-1 was explicitly gated on accumulated
decision-label volume (now plausibly available via LEARN-1 scorecards), and
CRM-2 is the unlock for action→pipeline attribution that LEARN-1/forecasting
need.

**Deferred-list discipline:** the `next-phase` do-not-build list (email/voice/
ads channels, campaign compiler, signal graph, forecasting, event bus,
LLM-judge evals, autopilot) remains **honored in the core loop** — Mira has no
channel send, no autopilot, no campaign runtime. The dry-run/controlled-live
closer work (§3) is consistent with this: it _simulates_ and never sends. The
one place the broader fence is _not_ honored is the agent-economy/credits
surface (§4).

---

## 3. Open PR / branch status rollup

> Compiled 2026-06-23 from the GitHub API (state, base, draft, CI check-run,
> stack position). CI = the GitHub Actions `build-test` check-run; "none" = no
> checks on the head commit (predominantly older/doc-only branches). **No open
> PR has failing CI.**

**Totals:** 99 open PRs · 98 drafts (only **#89** non-draft) · **0 failing CI**
(~63 pass, ~36 none) · 39 → `main`, 60 stacked on `claude/*` branches.

### 3.1 Stack topology (why nothing is merging)

```
main
 └─ #135 claude/w1-sales-closer-core-co3yll
     └─ #158 overnight/gtm-implementation   ← "mainline" this audit inspects
         └─ 22 PRs (Group B: Command Center, readiness audits, closer automation)
 └─ claude/ep002-mission-run-pPoba (integration branch, no PR of its own)
     └─ 24 PRs (Group C: Client-Zero, agent-economy, W-series, 36h/12h sprints)
```

The integration line is **3+ levels deep from `main`**, all draft, so the
22 Group-B PRs cannot reach `main` until #135 then #158 land. This is the
binding constraint on the whole program.

### 3.2 Group B — targeting `overnight/gtm-implementation` (22, the active line)

| PR# | Title (short)                                         | head branch                     | CI   |
| --- | ----------------------------------------------------- | ------------------------------- | ---- |
| 159 | Integration hardening: unified mock packet B1–B6      | alta-80-integration-hardening   | pass |
| 160 | GTM Command Center route B1–B6                        | alta-80-command-center          | pass |
| 161 | Command Center: 10 investor panels                    | gtm-command-center-panels       | pass |
| 162 | Enterprise-readiness controls (B6+)                   | enterprise-readiness-controls   | pass |
| 163 | Command Center e2e scenario tests                     | command-center-e2e-tests        | pass |
| 164 | Alta 90 final readiness audit                         | alta-90-readiness-audit         | pass |
| 165 | Proof + TrustOps evidence (correlated trace)          | proof-trustops-evidence-tvv9t5  | pass |
| 166 | Proof/action trace + TrustOps evidence                | proof-trustops-evidence-08x8t3  | pass |
| 167 | Harden /gtm-command-center server adapter             | gtm-command-center-adapter      | pass |
| 168 | Canonical Command Center (consolidate #158/#159/#160) | gtm-command-center-consolidate  | pass |
| 169 | Consolidate B1–B6 into /gtm-command-center            | funny-turing                    | pass |
| 170 | Controlled-live automation readiness docs             | controlled-live-automation-docs | pass |
| 171 | Disabled outbound connector ports                     | disabled-connector-ports        | pass |
| 173 | Consent/compliance readiness controls                 | consent-compliance-readiness    | pass |
| 174 | Automation kill-switch + rollback model               | automation-killswitch-rollback  | pass |
| 175 | Dry-run execution ledger                              | dry-run-execution-ledger        | pass |
| 176 | Controlled-live sandbox harness                       | controlled-live-sandbox         | pass |
| 177 | Automation approval queue read-model                  | approval-queue-read-model       | pass |
| 180 | Automation-readiness e2e test matrix                  | automation-readiness-tests      | pass |
| 182 | Automation monitoring readiness                       | automation-monitoring-readiness | pass |
| 184 | Rebase test matrix onto overnight tip                 | pr180-readiness-rebase          | pass |
| 186 | Reconcile #159+#160 into canonical                    | reconcile-159-160-canonical     | pass |

### 3.3 Group A — targeting `main` (39, mostly docs/audit + Client-Zero)

Notable: **#89** (investor-grade audit + wedge strategy — _the only non-draft
PR_), #137 (competitive moat roadmap), #143/#144/#146 (GTM-OS v0 reconciliation),
#149 (canonical merge/hold map for GTM-spine PRs — directly relevant to §5),
#117/#118 (execution board + global execution audit), and a cluster of
**review PRs** (#112–#116) reviewing other PRs. Many are doc/reconciliation
artifacts rather than code.

### 3.4 Group C — stacked on other `claude/*` branches (38, not mainline-reachable)

24 stack on `claude/ep002-mission-run-pPoba` (Client-Zero build plans,
agent-economy memos, 12h/36h sprint reports, passport/dispute specs, SOC2 prep);
the rest stack on the W-series / sales-closer-core branches. None can reach
`main` until their multi-level parents land.

### 3.5 Themes & overlaps to collapse

- **GTM Command Center — at least 5 competing attempts** (#160, #161, #167,
  #168, #169, with #186 reconciling #159+#160). #168 and #169 are explicitly
  "consolidate/canonical" PRs. **One must be chosen canonical; the rest closed.**
- **Proof/TrustOps evidence — duplicate pair** (#165 and #166, near-identical
  titles). Pick one.
- **Alta readiness audits — self-stacked line** (#164 ← #178, #181; plus #172,
  #181 the "80 readiness" variants). Consolidate to a single readiness audit.
- **Closer automation-readiness** (#170–#177, #180, #182, #184; #179 release-gate
  already merged) is the most coherent sub-stack and is the clean candidate for
  an ordered merge train once #158 lands.

---

## 4. Scope-fence divergence (owner decision required)

`docs/competitive/operating-plan.md` §0a (authoritative) forbids, without
explicit written re-authorization, any **agent-economy / marketplace**,
**token/crypto**, **credits/escrow as a product**, or **"Cognitia OS"** code
landing in base. The rule: spec-only artifacts on their own branch, never
merged into base.

**Observed on base `da48e8f`:**

- `apps/web/src/app/agent-economy/page.tsx` — "Agent Economy Lab console …
  Escrow Simulation on internal credits … public-token posture is locked." **[code]**
- `apps/web/src/app/credits/page.tsx` — "Internal Credits console … bookkeeping
  units, not a currency or token … wallet rows are inert placeholders." **[code]**
- Plus `/skills`, `/proofs`, `/agents` routes and matching API handlers/tests
  (`apps/api/src/{agentEconomy,credits.ledger,atc,frontdesk}.test.ts`). **[tests]**

These are **carefully fenced** (no payments, no chain, no email, simulation-only)
and traceable to merged work (LEGEND-001 Agent Fabric Lab, COG-009 credits,
the 12H crypto-visibility/agent-fabric sprint). But they are nonetheless
product-thesis-adjacent code on base, which §0a says requires an explicit
re-authorization that is not recorded in the operating plan.

**Decision needed (pick one):**

1. **Re-authorize + amend the fence** — if the agent-economy/credits lab is now
   an intended (simulation-only) part of the platform story, update
   operating-plan §0a to say so and keep the code.
2. **Quarantine** — move these surfaces to a clearly-labeled `spec`/`lab` branch
   off base, restoring §0a as written.

Either is fine; the gap is that the _as-built_ base and the _as-written_ fence
currently disagree, and the audit's job is to surface that, not to silently
pick.

---

## 5. Recommended next actions

**The dominant problem is convergence, not features.** In priority order:

1. **Land the spine onto `main`.** Drive the merge train
   `#135 (w1-sales-closer-core) → #158 (overnight/gtm-implementation) → main`.
   Until this happens, every Group-B PR (and the program's CI-green work) is
   stranded 3 levels deep. This is the single highest-leverage action.
   (#149's "canonical merge/hold map" already attempts to sequence this — adopt
   or supersede it explicitly.)
2. **Collapse the duplicates (§3.5).** Pick one canonical Command Center
   (#168 or #169), one Proof/TrustOps PR (#165 or #166), one Alta readiness
   audit; close the rest. ~5 Command Center attempts and a duplicate evidence
   pair are pure convergence tax.
3. **Resolve the §4 fence divergence** with an explicit written ruling and, if
   re-authorizing, a one-paragraph amendment to operating-plan §0a.
4. **Then run the closer automation-readiness stack as an ordered merge train**
   (ports #171 → dry-run ledger #175 → controlled-live sandbox #176 →
   kill-switch #174 → consent #173 → approval queue #177 → monitoring #182 →
   test matrix #180/#184), retargeted at mainline as #158 lands. Release-gate
   (#179) is already in. It is the most coherent sub-stack and all CI-green.
5. **Open the real next roadmap wave from §2:** **CRM-2** (stage-update action —
   the attribution unlock) then **TIER-1** (risk-tiered review, now that LEARN-1
   label volume exists). Both stay inside the core fence (CRM-only,
   approval-gated, no autopilot until TIER-1's label-gated graduation). Finish
   **SCOPE-2** (field-level write-scope check) alongside — cheap, high-assurance.
6. **Set a draft-PR hygiene bar.** 98 of 99 PRs are drafts; a draft that is
   CI-green and reviewed should be promoted and merged or closed. The backlog's
   size is itself a risk (review fatigue, drift, merge conflicts compounding).

---

## 6. Method & provenance

- Base inspected by direct checkout of `origin/overnight/gtm-implementation`
  @ `da48e8f`; roadmap items reconciled by grepping for each ticket's code/test
  artifact (paths cited inline).
- Open-PR rollup compiled from the GitHub API (state, base, draft, CI status,
  mergeability) on 2026-06-23.
- Bounded by `operating-plan.md` (scope fence) and continues
  `next-phase-2026-06.md` (which recorded the wave-1/wave-2 ships through
  2026-06-10). This document does **not** restate those; it audits forward from
  them.
