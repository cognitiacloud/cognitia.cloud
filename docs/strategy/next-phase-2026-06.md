# Next Phase — Current-State Audit, Alta Parity Map, Beat-Alta Memo, Roadmap

> Date: 2026-06-10. Base commit audited: `fdfa189` (all five "must" moat tickets
> merged: FLY-1, PROV-1, UX-2, MET-1, EVAL-1). Companion to
> `beat-alta-10x.md` (teardown) and `docs/competitive/operating-plan.md`
> (scope fence). Research basis: 5-track web research sprint (sources in §7);
> repo claims verified by direct inspection at the cited paths.
>
> Confidence labels used throughout: **[code]** verified in code,
> **[tests]** verified in tests, **[docs]** verified in docs only,
> **[inferred]** needs confirmation.

---

## 1. Current-state audit

### 1.1 What the product actually does today

One loop, end to end, and it is real:

```
HubSpot sync → Mira scores accounts & proposes CRM actions → operator approves/
rejects each with a mandatory reason code → approved action executes as an
idempotent, provenance-stamped HubSpot task → immutable event + audit trail →
trust metrics & decision history derived live from the ledger.
```

- Proposal pipeline: `packages/agents/src/mira/mira.ts:74-200` — rank accounts
  (`scoring.ts`, deterministic, no LLM), build evidence-backed context pack
  (`context/contextBuilder.ts`), partition suppressed contacts, propose
  `crm.task.create` per selected account. **[code]**, pinned by
  `packages/evals/src/golden.test.ts` **[tests]**.
- Decision: approve/reject (single + batch) requires a closed-enum reason code;
  persisted to `feedback_labels` with a self-contained snapshot
  (`apps/api/src/handlers.ts`, `packages/agents/src/ledger/actionLedger.ts`).
  **[code]** + `decisionReasons.test.ts`, `batchDecide.test.ts` **[tests]**.
- Execution: `ActionLedger.execute` refuses unapproved actions, resolves
  provenance (run + approval label), dispatches via `AdapterRegistry` →
  `StubHubspotAdapter` → `HubspotClient`; result + idempotent-replay flag
  stored on the action; events + audit entries on every transition
  (`actionLedger.ts:146-200`). **[code]** + `crmExecute.test.ts`,
  `provenance.test.ts` **[tests]**.
- Real CRM I/O: `HttpHubspotClient` (`packages/integrations/src/hubspot/httpClient.ts`)
  implements CRM v3 reads (companies/contacts/deals, cursor pagination,
  PII-hashing at the boundary) and idempotent engagement writes (search-by-
  idempotency-property, then create) with 429/5xx backoff. **[code]** +
  `httpClient.test.ts` **[tests]**.

### 1.2 Modules / surfaces that exist

| Surface             | Reality                                                                                                                           | Evidence                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| API (Fastify-style) | 19 routes: health, accounts(2), campaigns(2, stub), agent-runs(2), agent-actions(7), decisions(2), metrics(2), webhook + sync job | `apps/api/src/server.ts:122-190` **[code]**                                 |
| Operator console    | **One real page**: `/approvals` (queue, batch ops, reason capture, decision history, trust strip, token sign-in)                  | `apps/web/src/app/approvals/page.tsx` **[code]**                            |
| Worker              | CRM sync runtime + job                                                                                                            | `apps/worker/src/jobs/crmSync.ts` **[code]**                                |
| n8n edge automation | **Contracts only** — typed `WORKFLOWS` descriptors; no shipped n8n JSON in repo                                                   | `packages/workflows/src/index.ts` **[code]**; aspirational beyond contracts |
| Agents              | Mira real; Echo/Atlas/Beacon **planned only**                                                                                     | `docs/AltaSpec_v2.yaml` **[docs]**                                          |

### 1.3 Workflows: real vs aspirational

- **Real:** sync→propose→approve→execute→audit (above); inbound-lead webhook;
  HubSpot webhook verification (`webhook.ts` **[tests]**).
- **Aspirational:** campaigns/sequences/touchpoints (POST /campaigns returns
  501 `handlers.ts:327-330` **[code]**; **no campaigns/sequences/signals/
  playbooks tables exist in the live schema** — `packages/db/src/schema.ts:171-184`
  lists 13 tables; AltaSpec's migrations 0005/0006 are spec, not shipped
  **[code]**). Email machinery (draft store, generator, reply classifier,
  email adapter) exists and is tested but is **fenced off**: in `v1Mode` the
  email adapter is not even registered (`packages/agents/src/services.ts:54-58`)
  and Mira's email branch is skipped (`mira.ts` `emailEnabled=false`)
  **[code]** + `fence.test.ts` **[tests]**.
- **Dead seam:** `packages/integrations/src/hubspot/provider.ts` is a
  throw-only stub superseded by the adapter+client path. Candidate for
  deletion. **[code]**

### 1.4 Action classification

- **Read-only:** accounts list/context, action/decision/metric reads — all
  tenant-scoped, viewer-allowed. **[code: handlers.ts]**
- **Approval-gated mutations:** approve/reject(+batch) require operator/owner
  (`MUTATING_ROLES`, `auth.ts:99`); execute requires operator/owner AND prior
  approval (`ExecutionError` → 409). **[code+tests: serverAuth.test.ts, fence.test.ts]**
- **Executable side effects:** exactly two action types route to an adapter —
  `crm.task.create`, `crm.note.create` (`adapter.ts:17-19`). Mira proposes
  only tasks today. **[code]**
- **Tool runtime:** `ToolRegistry` exists with a `sideEffect` flag and
  `DirectExecutionForbiddenError` — side-effecting tools cannot be invoked
  directly, by construction (`packages/agents/src/tools/registry.ts`).
  Minimal usage today; this is the seam for safer extensibility. **[code]**

### 1.5 CRM objects / write paths

- **Reads:** companies→accounts, contacts→contacts, deals→opportunities, with
  `external_object_maps` identity mapping and `sync_runs` bookkeeping
  (`sync.ts`). **[code+tests: sync.test.ts, e2e.hubspotSync.test.ts]**
- **Writes:** HubSpot Tasks and Notes only. **Audit finding (gap):** the write
  payload today is `{ payload_ref: null }` + idempotency key + provenance
  properties (`adapter.ts:26-36`, `httpClient.ts:197-203`) — **no
  `hs_task_subject`/`hs_task_body`**. The operator approves an action whose
  executed CRM artifact has no typed human-readable content, and the console
  cannot show what will be written. This contradicts our own review-first
  story and is fixed by GOV-1 (§5). **[code]**

### 1.6 Lineage / provenance / auditability

- 6 namespaced `cognitia_*` properties + `cognitia_idempotency_key` stamped on
  every write (`httpClient.ts:291-312`); approver resolved from the FLY-1
  approval label at execution (`actionLedger.ts:247+`). **[code+tests: provenance.test.ts]**
- Immutable `events` (typed registry, zod-validated payloads,
  `core/src/events/index.ts`) + `audit_events` on propose/approve/reject/
  execute/fail. **[code+tests]**
- **Gap:** execution _denials_ (execute-before-approve) throw 409 but are not
  audited — the refusal leaves no audit artifact. Fixed in GOV-1. **[code: actionLedger.ts:152-154]**

### 1.7 Trust metrics / eval systems

- `GET /metrics/trust`: approval rate, reason mixes, median decision latency,
  duplicates prevented — computed live from ledger + labels
  (`apps/api/src/trustMetrics.ts`). **[code+tests]**
- Golden dataset + falsifiable CI gate running the **real runtime** against 5
  invariants (`packages/evals/src/harness.ts`, `golden.test.ts`);
  falsifiability was explicitly verified during EVAL-1 review
  (`docs/launch/review-log.md`). **[code+tests+docs]**

### 1.8 CI enforcement

`.github/workflows/ci.yml`: format check, typecheck, full test suite (183
tests / 31 files at `fdfa189`) on every push + PR — the eval gate and fence
tests ride `pnpm test`, so scope-fence or invariant regressions fail CI.
**[code]** (Branch protection/auto-merge are repo settings still pending —
**[docs: review-log]**.)

### 1.9 Deployment / operator docs

Operator handoff, go-live checklist, HubSpot onboarding runbook (including the
7 required custom properties), security control matrix/risk register/evidence
checklist, incident/backup/rotation runbooks, v1 acceptance tests
(`docs/launch/*`, `docs/runbooks/*`, `docs/security/*`). **[docs]** — live
alpha (B-3 operator setup, B-5 deploy controls) remains open.

### 1.10 Real architectural seams

1. **Ledger as control plane** — all side effects must pass propose→approve→
   execute (`actionLedger.ts`); this is where preview/undo/tiering attach.
2. **`HubspotClient` boundary** — one interface for all CRM I/O with a fake +
   real implementation; typed write-plan layer slots directly above it.
3. **`AdapterRegistry` + `ToolRegistry`** — the dual-integration seam already
   exists in embryo: typed CRM adapters vs gated generic tools.
4. **Typed event registry** — domain events without a bus; sufficient at
   current scale (single API + worker).
5. **Repository contract** (`repository.contract.ts`, in-memory + Kysely/RLS)
   — lets us run the real runtime against ephemeral repos (the EVAL-1 harness
   exploits this; SIM-1 reuses it for tenant-data preflight).

---

## 2. Alta parity map

Lens: the competitor model in `beat-alta-10x.md` §3 (workspace, campaigns,
inbox, prospects, performance, assistants, workflows, knowledge, audiences,
multichannel, CRM sync, HITL, signals, runtime, evals, voice, enterprise
trust). Competitive facts below from the June 2026 research sprint; Alta's
in-product governance depth could not be third-party verified (site blocks
crawlers) — treat Alta claims as **[vendor-claim]**.

**Corrected fact:** Alta raised a **$7M seed** (Mar 2025, Entrée Capital +
Target Global). The $11.5M figure circulating internally is **Artisan's**
seed. No Alta raise after the seed was found through June 2026.

### A. Already competitive (and in two cases, ahead of everyone)

| Capability                                                            | Us                                       | Best competitor                                                            | Verdict                                                  |
| --------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Per-action human approval of CRM writes                               | Shipped, per-action, role-gated          | HubSpot Breeze "review before running" toggle; Artisan Copilot (per-email) | Parity-or-better vs incumbents; ahead of AI-SDR startups |
| **Mandatory structured decision reasons**                             | Shipped (closed enums, every decision)   | **Nobody ships this**                                                      | Category white space — ours                              |
| **CRM write provenance ("written by agent X, run Y, approved by Z")** | Shipped (6 stamped properties)           | Clay = operator-built pattern only; no vendor default                      | White space — ours                                       |
| **Eval gate before any behavior change**                              | Shipped (golden gate in CI, falsifiable) | Nobody (de facto pattern is "start copilot, graduate")                     | White space — ours                                       |
| **Live trust metrics from decision labels**                           | Shipped (`/metrics/trust`)               | Nobody publishes; 11x is the anti-example                                  | White space — ours                                       |
| Idempotent, dedup-proof CRM writes                                    | Shipped + CI-proven                      | Unify/Clay sync hygiene (different problem)                                | Competitive                                              |
| Tenant isolation (RLS) proven in tests                                | `kysely.rls.pglite.test.ts`              | Asserted, not demonstrated, by startups                                    | Competitive                                              |

### B. Partially present / thin

- **Performance/analytics surface:** trust strip + 2 metrics endpoints; no
  per-segment scorecards, no exportable report. (Seek parity via TRUST-2/
  LEARN-1, not dashboards-for-show.)
- **Knowledge/context:** evidence packs from CRM facts; vector retriever
  interface exists with a null implementation (`contextBuilder.ts:9-17`). Thin
  by design until a real retrieval need arrives.
- **Workflows/automation fabric:** typed n8n contracts, no shipped workflows.
- **Operator console:** one page. It is the right page, but session-token
  sign-in and single-surface UX is alpha-grade. (B-3/B-5 work.)
- **CRM breadth:** HubSpot only; tasks/notes only (no stage updates yet —
  CRM-2 is fence-sanctioned "behind approval").

### C. Missing but important (we should close)

- **Pre-write typed preview** of the exact CRM payload (no vendor ships this
  either — but Breeze's approval toggle + Agentforce audit trail set the
  _direction_; an approval gate that can't show the write is half a gate). → GOV-1.
- **Preflight/simulation onboarding** ("show me what it WOULD do before it
  touches anything") — buyers' suggest-don't-write default demands it. → SIM-1.
- **Approval lifecycle** (SLA, reminders, expiry, escalation) — durable-
  execution patterns (signal+timer) are standard elsewhere. → LIFE-1.
- **Rollback/undo artifacts** — RevOps explicitly buys rollback; Salesforce
  field audit trail "can't roll back" is a documented pain. → UNDO-1.
- **Exportable, customer-reviewable trust/audit report** — procurement asks
  for reviewable logs; champions need defensible artifacts. → TRUST-2.

### D. Intentionally out of scope now (refuse parity)

Multichannel execution (email/voice/ads), unified GTM workspace breadth,
campaign/sequence runtime, signal graph + enrichment marketplace, voice
runtime, forecasting/revenue intelligence. Rationale: the AI-SDR category's
churn pathology (50–70% pre-renewal churn reported; 11x post-mortem) traces to
breadth-without-trust and data quality, and the fence is our differentiator.
Each remains gated on an explicit fence revision (operating-plan §0).

---

## 3. How we win (not just catch up)

Pressure test of the seven teardown openings, with the research verdicts.

### 3.1 Coherence & truthfulness

**Winning looks like:** every surface tells the same story the database tells;
no aspirational UI. **Operator-visible:** action detail = exact CRM payload +
policy verdict + evidence + lineage; metrics derived only from the ledger
(already true). **Primitives:** typed write plans (GOV-1); deleting dead seams
(provider.ts); 501s stay 501 until real. **MVP:** GOV-1. **Risk if badly
built:** preview drifts from write → trust theater; mitigated by a
preview-equals-write CI invariant (assembled by the same pure function, then
asserted byte-equal in tests).

### 3.2 Deterministic governance

**Winning:** policy decisions are pure functions whose verdicts are shown
_before_ execution and re-checked _at_ execution; denials leave audit
artifacts. **Operator-visible:** "blocked: suppressed target" rendered in
preview, not discovered at 409. **Primitives:** PolicyGate (exists), guardrail
results (exist, stored), denial audit (GOV-1), risk tiers (TIER-1 later).
**MVP:** expose what exists in preview; **v2:** tiered review with sampled
audits — justified by automation-complacency research (reviewer accuracy
degrades as agent reliability rises; the fix is risk-tiering + sampling, not
more queue). **Risk:** tiering shipped before calibration data exists →
premature autonomy; gate on label history (evals.md §3a already commits to this).

### 3.3 CRM-native transparency & lineage

**Winning:** the customer's own CRM is the audit UI — any rep can see what
wrote a record, why, who approved. Shipped (PROV-1). **Next:** preview shows
the provenance properties pre-write (GOV-1); TRUST-2 exports the cross-CRM
view. **Risk:** property sprawl in customers' portals; mitigated by the fixed
namespaced set + onboarding runbook (already the contract).

### 3.4 Signal quality & freshness controls

**Verdict: defer.** Real signal infra (graph, enrichment, freshness SLAs) is
premature: Mira's inputs today are first-party CRM facts. The honest V1 move
is _visibility_, not infrastructure: surface "evidence from sync run X at time
T" in previews (cheap, rides GOV-1's evidence display). Build the graph when
there are ≥2 signal sources. **Risk if built now:** an enrichment stack with
no consumers — exactly the breadth trap.

### 3.5 Closed-loop execution → forecast/planning

**Verdict: defer, honestly.** We have actions→outcomes only as far as
"executed" — no meeting/opportunity attribution yet. A forecast on top of that
would be narrative, not evidence (the anti-pattern the brief names). The
credible seed: per-segment scorecards from decision labels (LEARN-1), which
become attribution-bearing once stage-update actions (CRM-2) connect actions
to pipeline objects. Sequence: CRM-2 → LEARN-1 → only then planning views.

### 3.6 Safer extensibility

**Winning:** new action types are _typed plans + compensators + eval
scenarios_, not webhooks. The dual seam already exists (AdapterRegistry for
typed CRM writes; ToolRegistry refusing direct side effects). **MVP:** codify
the contract: an action type ships with (a) a write-plan builder, (b) golden
scenario(s), (c) a compensator or an explicit `irreversible` marker (UNDO-1).
**Risk:** a "tool platform" before a second agent exists; keep it a contract,
not a framework.

### 3.7 Onboarding speed via simulation/preflight

**Winning:** day-0 value with zero risk: connect read-only → sync → preflight
report ("Mira would propose these 12 tasks; 2 contacts excluded as
suppressed; zero writes performed"). This weaponizes our own eval harness
against the buyer's live data — no competitor has an equivalent, and the
RevOps default posture ("never write directly; produce a report for review")
is _exactly this feature_. **Primitives:** ephemeral in-memory repo seeded
from tenant rows + the real runtime (harness pattern) + GOV-1 write previews.
**MVP:** SIM-1 (report via API + console). **v2:** scheduled preflight diffs.
**Risk:** simulation drifting from production behavior — mitigated because it
_is_ the production runtime over a repo copy, and CI's golden gate pins it.

### Strategic synthesis

The research is unambiguous: the four things nobody ships (mandatory reasons,
write provenance, eval gates, live trust metrics) are the four things we
shipped last sprint. The competition's failure mode is governance-as-marketing
(Alta's unverifiable claims, 11x's collapse) while incumbents ship real but
_coarse_ primitives (a review toggle, an org-wide audit trail). Our play is
precision: **make the gate able to show exactly what it is gating (GOV-1),
make the first contact with a buyer's CRM provably side-effect-free (SIM-1),
and make the accumulated decisions exportable evidence (TRUST-2)** — then
spend the label history we uniquely accumulate on risk-tiered review (TIER-1),
which is the earned-autonomy expansion story Bessemer describes and nobody in
GTM has built.

---

## 4. Architecture pressure-test verdicts

| Question                                         | Verdict                                                                                                                                  | Evidence                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Event model beginnings?                          | **Yes — sufficient.** Typed registry + immutable table. No bus until a second consumer process exists.                                   | `core/src/events/index.ts`           |
| Canonical object graph now?                      | **No.** accounts/contacts/opportunities + external maps cover V1; campaign/signal objects arrive with their features.                    | `db/src/schema.ts`                   |
| Dual integration architecture?                   | **Already emerging — formalize, don't invent.** Typed CRM layer (HubspotClient) + gated ToolRegistry.                                    | `integrations/`, `agents/src/tools/` |
| Campaign compiler?                               | **Premature.** No campaign runtime exists; revisit at CRM-2+sequencing.                                                                  | handlers.ts:327 (501)                |
| Policy evaluation visible pre-execution?         | **Yes, cheap.** PolicyGate + stored guardrails exposed via preview.                                                                      | GOV-1                                |
| Provenance/diffs/rollback as operator artifacts? | Provenance ✅; preview = GOV-1; rollback = UNDO-1 (design constraint now: store external refs — already done via `result.external_ref`). | `actionLedger.ts:182`                |
| Eval layer operator-grade?                       | **Yes — SIM-1** turns the harness pattern into an operator feature.                                                                      | `evals/src/harness.ts`               |
| Smallest preflight simulator?                    | Ephemeral repo + real runtime + write plans; zero persistence.                                                                           | SIM-1 plan                           |

---

## 5. Top-10 roadmap

Scores 1–5 (5 best). L=leverage, C=customer-visible, M=moat, E=eng complexity
(5=easy), D=dependency risk (5=none), T=time-to-value (5=fastest),
A="matters in a buyer comparison vs Alta".

| #   | Item                                                                                                            | L   | C   | M   | E   | D   | T   | A   | Layer  |
| --- | --------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | --- | ------ |
| 1   | **GOV-1** Typed write preview + preview-equals-write CI invariant + audited denials                             | 5   | 5   | 5   | 4   | 5   | 5   | 5   | 30-day |
| 2   | **SIM-1** Preflight simulation (zero-write dry run on tenant data + report)                                     | 5   | 5   | 4   | 4   | 4   | 5   | 5   | 30-day |
| 3   | **TRUST-2** Exportable tenant trust/audit report (procurement-reviewable artifact)                              | 4   | 4   | 4   | 4   | 5   | 4   | 4   | 30-day |
| 4   | **REGR-1** Rejection→regression flywheel (promote rejected actions to golden scenarios)                         | 4   | 3   | 5   | 3   | 4   | 3   | 4   | 60–90  |
| 5   | **TIER-1** Risk-tiered review + sampled audits + label-history gating (earned autonomy)                         | 5   | 4   | 5   | 2   | 2   | 2   | 5   | 60–90  |
| 6   | **CRM-2** Stage-update action behind approval (same machinery, new typed plan + compensator + golden scenarios) | 4   | 4   | 3   | 3   | 3   | 3   | 4   | 60–90  |
| 7   | **UNDO-1** Compensators/undo window (archive task/note; `irreversible` markers raise review tier)               | 4   | 4   | 4   | 3   | 3   | 3   | 4   | 60–90  |
| 8   | **LIFE-1** Approval lifecycle: SLA timers, reminders, expiry, escalation (n8n contract + ledger states)         | 3   | 4   | 3   | 3   | 3   | 3   | 3   | 60–90  |
| 9   | **LEARN-1** Per-segment scorecards (approval rate × action_type × risk) feeding targeting                       | 3   | 3   | 4   | 4   | 3   | 3   | 3   | 60–90  |
| 10  | **SCOPE-2** Documented agent identity + field-level write scope enforcement check                               | 3   | 3   | 3   | 4   | 5   | 4   | 3   | 60–90  |

**Deferred / do-not-build-yet** (each fails the decision rule today):
email/voice/ads channels (fence; churn pathology), campaign compiler &
sequence runtime (no campaign objects exist), signal graph/enrichment stack
(one signal source), forecasting & revenue intelligence (no action→outcome
chain until CRM-2+LEARN-1), event bus (no second consumer), LLM-as-judge evals
(deterministic invariants not exhausted; judge drift is documented), autopilot
mode (TIER-1's label-gated graduation must come first), ISO 42001 pursuit
(no RFP evidence mid-market; revisit at enterprise deals).

### Top-3 detail (chosen first wave)

**GOV-1 — typed write preview.** _Problem:_ operators approve actions whose
exact CRM payload neither they nor the console can see; today's payload is
near-empty (`payload_ref: null`) — the approval reviews a description, not the
write. _Pain:_ reviewer can't answer "what exactly lands in my CRM?" — the #1
RevOps question. _Vs Alta:_ converts our gate from "approval exists" (parity
with Breeze) to "approval shows the byte-exact write, proven equal in CI"
(nobody has this). _Repo impact:_ `packages/integrations/src/hubspot/`
(write-plan module + adapter/httpClient refactor to consume it),
`packages/agents` (ledger preview + denial audit), `apps/api` (preview route),
`apps/web` (preview panel). _Data model:_ none (pure derivation). _Tests:_
plan determinism; **preview === executed write properties** (fake-fetch
capture); denial audit; route auth. _Rollout:_ pure addition behind existing
auth. _Proof:_ CI invariant green + preview visible in console for every
proposal.

**SIM-1 — preflight simulation.** _Problem:_ first contact with a buyer's CRM
currently requires a live run (writes after approval); buyers' default is
"don't write — show me a report." _Vs Alta:_ onboarding becomes "we ran our CI
harness on your data, zero writes, here's the exact would-be plan" — converts
EVAL-1 from internal CI into a sales artifact. _Repo impact:_ `apps/api`
(preflight handler/route: snapshot tenant rows → ephemeral InMemoryRepository
→ real services → report with GOV-1 write previews), `apps/web` (preflight
button + report). _Data model:_ none (nothing persisted — that is the
feature). _Tests:_ zero-mutation assertion on the live repo; report shape;
suppression exclusions reported. _Proof:_ preflight on seeded tenant returns
N would-be writes while `agent_actions` count stays 0.

**TRUST-2 — exportable trust report.** _Problem:_ trust metrics live behind
an API; champions and procurement need a reviewable artifact. _Vs Alta:_
nobody publishes trust numbers; 11x made them up — we export them from the
ledger. _Repo impact:_ `apps/api` (report endpoint composing metrics +
decision history + provenance contract), docs (methodology note). _Wave 2 of
30-day window_ — not in first execution wave.

---

## 6. Wave-1 execution plan (this session)

1. **GOV-1** branch `claude/gov-1-typed-write-preview`: write-plan module →
   adapter/client consume it → ledger `previewExecution` + denial audit →
   `GET /agent-actions/:id/preview` → console panel → tests → docs → PR.
2. **SIM-1** branch (after GOV-1 merges; reuses write plans):
   `POST /agent-runs/mira/preflight` → report → console → tests → docs → PR.
3. TRUST-2 follows in a subsequent session (scoped, independent).

Constraints honored: fence untouched (no channels, no autonomy); approval
semantics strengthened, not weakened (denials now audited; preview adds
information before consent); every new path read-only or derivation-only.

---

## 7. Decision log

| Decision                                                           | Basis                                                                       |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Wave-1 = GOV-1 + SIM-1 (TRUST-2 next)                              | §5 scores; both close audit-discovered coherence gaps; zero data-model risk |
| No event bus, no object graph, no campaign compiler now            | §4 pressure tests                                                           |
| Risk-tiering (TIER-1) deferred until label volume exists           | complacency research + evals.md §3a gating commitment                       |
| Signal/forecast layers deferred                                    | §3.4/§3.5 — no second source, no outcome chain                              |
| Correct Alta funding fact internally ($7M seed; $11.5M is Artisan) | PR Newswire (Mar 2025) via research sprint                                  |
| Treat Alta governance depth as unverified                          | site blocks crawlers; no third-party teardown exists                        |

### Research appendix (key sources)

Workflow moat: Harvey Review Tables; Ironclad Playbook approvals; Abridge
Linked Evidence; Sierra ADLC ("every improvement becomes a regression test");
Decagon Watchtower; Norm Ai (audit record as system of record); a16z "Is
Software Losing Its Head?"; Bessemer Vertical AI playbook. HITL: Temporal
signal+timer approval pattern; AWS waitForTaskToken; LangGraph interrupts +
Agent Inbox (accept/edit/respond/ignore); Parasuraman & Manzey 2010
(automation complacency); GitHub stale-approval dismissal; transactional
outbox + saga compensators. Evals: Hamel Husain evals essays; Shankar et al.
EvalGen (criteria drift); Braintrust/LangSmith CI gating; Harvey BigLaw Bench,
Sierra τ-bench, Abridge peer-reviewed studies (benchmark-as-GTM); conformal
risk control (calibration-gated tiers — no production precedent found).
Competitive: TechCrunch on 11x (Mar/May 2025); Artisan Copilot/Autopilot docs;
Regie Auto-Pilot; Clay/Unify enrichment hygiene; Agentforce Einstein Trust
Layer + audit trail; HubSpot Breeze "review before running"; Gartner >40%
agentic-AI cancellation prediction (June 2025) and agent-sprawl guidance
(Apr 2026); MIT NANDA 95% pilot-failure "learning gap" report.

---

## 8. Wave-1 execution result (2026-06-10)

Both chosen wave-1 items shipped, merged, and CI-green on the base branch.

| Item                                            | PR  | Merge     | Tests added | What it proves                                                        |
| ----------------------------------------------- | --- | --------- | ----------- | --------------------------------------------------------------------- |
| Strategy (this doc)                             | #9  | `47e79c7` | —           | fact base + plan                                                      |
| **GOV-1** typed write preview + audited denials | #10 | `8de6a2a` | +12         | the gate shows the byte-exact write; preview === write (CI invariant) |
| **SIM-1** zero-write preflight simulation       | #11 | `2130544` | +7          | first contact with a buyer's CRM is provably side-effect-free         |

Base `2130544`: **201 tests / 34 files green**; typecheck + format green.

### Where we were → what we changed → why it matters → next audit

**Where we were (`fdfa189`).** Five trust primitives nobody else ships
(mandatory decision reasons, CRM write provenance, eval gate, live trust
metrics, suppression). But the audit found the gate was reviewing a
description, not the write: executed tasks carried `payload_ref: null` + metadata
and no human-readable content, the console couldn't show what would land in
the CRM, and refused executions left no audit artifact. Onboarding required a
live (post-approval) run to see anything.

**What we changed.** GOV-1 made the exact CRM write a first-class, typed,
previewable artifact assembled by one pure function shared by preview and
execution — so the operator sees byte-for-byte what will be written, proven
equal in CI — and turned silent execution refusals into audited events.
SIM-1 turned the EVAL-1 harness into an operator feature: the real runtime
over an ephemeral copy of the tenant's data, reporting every would-be write
plan while guaranteeing zero side effects.

**Why it matters vs Alta.** Per-action approval is now table stakes (Breeze,
Artisan). What no GTM-agent vendor ships — verified June 2026 — is an approval
that displays the exact, CI-verified write; an audited denial trail; or a
side-effect-free dry run on the buyer's own CRM. We now ship all three on top
of the four white-space primitives. The competition's failure mode is
governance-as-marketing (Alta's unverifiable claims; 11x's collapse) and
coarse incumbent primitives (a toggle, an org-wide log). Ours is precision:
every write path is now inspectable, testable, and explainable before consent.

**What the next audit should show.** An honest evaluator running the repo at
`2130544` can verify, not take on faith: (1) approve an action → open its
preview → the property map equals what execution sends (`writePlan.test.ts`);
(2) run preflight on seeded tenant data → N would-be writes, `agent_actions`
count stays 0 (`preflight.test.ts`); (3) execute-before-approve → a 409 **and**
an `execution_denied` audit row. Alta may still be broader, but on the axes
where enterprise operators feel risk — _can I see what it will write, can I try
it without risk, is every refusal on the record_ — this product is now
demonstrably ahead.

### Recommended next (not built this session)

In priority order, each tied to the roadmap §5 scores and the do-not-build
list: **TRUST-2** (exportable, procurement-reviewable trust/audit report —
completes the 30-day window; the champion's defense artifact), then **REGR-1**
(promote rejected actions into golden scenarios — closes the
human-correction→regression-test flywheel the eval research identifies), then
**TIER-1** (risk-tiered review gated on accumulated label history — the
earned-autonomy expansion story, but only once label volume exists; premature
before TRUST-2/REGR-1). Still firmly deferred: channels, campaign compiler,
signal graph, forecasting, event bus, LLM-judge evals, autopilot.

---

## 9. Wave-2 execution result (2026-06-10, same day)

All three wave-2 items shipped, merged, CI-green on base `6cb3038`
(**225 tests / 39 files**; typecheck + format green).

| Item                                          | PR  | Merge     | Tests added | What it proves                                                                                                                                                                                            |
| --------------------------------------------- | --- | --------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UNDO-1** typed rollback for executed writes | #13 | `01733c8` | +13         | every write can be undone, with the undo as accountable as the execution (label + event + audit; refusals audited as `rollback_denied`)                                                                   |
| **TRUST-2** exportable trust packet           | #14 | `324aa40` | +4          | trust is a one-click artifact: live metrics + full decision/audit history + 10 control attestations citing their CI test files (pointer staleness is itself tested) + the eval gate re-run at export time |
| **REGR-1** rejection→regression flywheel      | #15 | `6cb3038` | +7          | operator rejections export anonymized scenario candidates; an unfixed rejection fails the harness (proven), the fix is CI-locked forever; adopted dataset carries operator-decision provenance            |

### The full write lifecycle is now closed and accountable

```
preflight (zero writes, proven) → propose (evidence + policy) →
preview (byte-equal to the write, CI-invariant) → approve (mandatory reason
= training label) → execute (idempotent + provenance-stamped) →
undo (reversible archive, same accountability) →
reject path feeds the CI gate (anonymized regression scenarios) →
everything exportable in one procurement-grade packet
```

No vendor surveyed in the June 2026 teardown — Alta, 11x, Artisan, Regie,
Clay, Unify, Agentforce, Breeze — ships any single stage of that lifecycle
with proof, let alone the closed loop.

### Remaining honest gaps vs Alta (unchanged posture)

Breadth: multichannel execution, campaign orchestration, inbox, voice,
enrichment, forecasting — all still intentionally fenced (operating-plan §0).
The deferred list stands: TIER-1 (risk-tiered review) is now the top
candidate once label volume accumulates; channels remain a day-60+ decision.

### Next best move

Operational, not code: live alpha (B-3 operator setup per
`hubspot-onboarding.md` — now including preflight as step one — and B-5
deploy controls), then TIER-1 once decision-label volume justifies it.
