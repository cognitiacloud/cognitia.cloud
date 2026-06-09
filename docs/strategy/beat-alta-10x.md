# Beat Alta 10x — Research Dossier & System Redesign Plan

> Strategy track, isolated from the V1 alpha path (docs-only; fence untouched).
> Sources: live web research 2026-06 + the prior Alta teardown. Facts cited; inference marked.
> Binding constraint: V1 fence stays intact on the launch branch; everything here is post-alpha.

---

## 1. Executive summary — how Cognitia beats Alta

**The AI-SDR category is having a trust collapse, and Alta's strategy is breadth. Cognitia's
10–100x path is to become the _accountable revenue-action system_ — the one vendor whose
agent actions are provably safe, evidenced, measured, and that demonstrably improves —
selling into a market full of burned buyers.**

The research is unambiguous:

- AI-SDR tools churn at **50–70% within a year** ([prospeo](https://prospeo.io/s/ai-sdrs), [autobound buying guide](https://www.autobound.ai/blog/ai-sdr-buying-guide-2026)).
- The category leader cautionary tale: **11x** — reported 70–80% churn, fabricated customer
  claims, ZoomInfo legal threats ([naoma](https://www.naoma.ai/articles/what-is-an-ai-sdr), TechCrunch via search).
- **Artisan**'s output flagged as "generic, template-like"; **LinkedIn restricted its
  automation in early 2026** ([coldreach review](https://coldreach.ai/blog/artisan-ai-review)) — externally validating our LinkedIn fence.
- **Alta itself** (G2/users): LinkedIn integration "difficult to maintain… not stable… additional
  cost"; setup "overwhelming"; onboarding needs hands-on support; opaque volume-based pricing
  ([G2 reviews](https://www.g2.com/products/alta-ai-revenue-workforce/reviews), [Alta FAQ](https://www.altahq.com/faq)).
- **HubSpot Breeze** (the native threat) is a "**black box** — you cannot customize the AI's
  underlying instructions," requires Pro/Enterprise hubs, and its credit pricing balloons
  (~$0.50/resolution → $3k+/mo at volume) ([resolve247](https://resolve247.ai/blog/hubspot-breeze/), [myaskai guide](https://myaskai.com/blog/hubspot-breeze-ai-agent-complete-guide-2026)).

**Therefore:** don't chase Alta's 4-agents/5-channels breadth. Win on three compounding moats
they structurally can't copy fast:

1. **The approval-decision flywheel** — every operator approve/reject/edit (with required
   reason) becomes labeled training data → per-segment quality scorecards → **earned, graduated
   autonomy**. Alta/11x lean autopilot-first; their architecture doesn't harvest human judgment.
2. **Decision provenance inside HubSpot** — every object we create carries run-id, evidence
   summary, and an approval-chain link as HubSpot properties. Auditability _visible in the
   buyer's CRM_. Breeze is a black box; Alta doesn't surface this.
3. **Published trust benchmarks** — a live, customer-visible trust dashboard (approval rate,
   evidence coverage, zero-duplication, reviewer latency) backed by a real eval harness whose
   records double as SOC 2 evidence. Turn the category's trust collapse into demand-gen.

The "10–100x more valuable" math is retention economics: in a 50–70%-churn category, the
vendor that retains (because quality is provable and improving) compounds while competitors
re-acquire their entire base annually — and compliance-as-product unlocks the enterprise
segment none of the burned SMB tools can touch.

---

## 2. Research dossier (by lane, with sources)

### Lane A — Competitive

**Alta wins today on:** breadth (Katie/Alex/Luna/Greg; email/LinkedIn/SMS/WhatsApp/voice),
real certifications (SOC 2 Type 2, ISO 27001/27018), marketplace presence (HubSpot, Salesforce
AppExchange), G2 High Performer momentum, dedicated onboarding.
**Alta is weak on:** LinkedIn stability + hidden cost (their own reviewers), configuration
overload ("overwhelming… if not tech-savvy"), onboarding dependency on their team, opaque
pricing ($1–3k/mo band, volume-based), and — by positioning — autopilot-forward in a market
that just got burned by autopilot. No visible per-action audit trail, no published quality metrics.
**Adjacent category:** 50–70% churn; failure root cause = "signal quality… personalization
quality, and brand safety controls — not demo polish" ([autobound](https://www.autobound.ai/blog/ai-sdr-buying-guide-2026)); deliverability craters at 10–15% bounce.
**HubSpot Breeze:** GA prospecting/customer/data agents inside the CRM; limitations = black-box
behavior, hub/tier gating, credit costs. It will commoditize _shallow_ prospecting — our answer
is governance depth, not feature parity.
**Wedge:** "The governed alternative — agents that earn autonomy and prove every action."

### Lane B — Differentiators (hard to copy)

1. Approval-decision flywheel → labeled dataset nobody else is collecting (approve/reject/edit
   - mandated reasons). Compounds daily from alpha day 1.
2. **Earned autonomy levels** per action-type × segment: `manual → batch-approve → notify-only`,
   each tier unlocked only by measured approval-rate thresholds, never default. (The exact
   inverse of 11x; calibration target: <5–10% of actions needing review at maturity, per HITL
   research — [cordum](https://cordum.io/blog/human-in-the-loop-ai-patterns), [arunbaby HITL patterns](https://www.arunbaby.com/ai-agents/0025-human-in-the-loop-patterns/).)
3. Decision provenance in-CRM (Lane G below).
4. Evidence-or-block proposals (we already enforce evidence refs — productize it as
   "no ungrounded claims, mechanically enforced").
5. Trust dashboard + eval records as dual product/compliance artifact.

### Lane C — Workflow/UX (post-UI-1 console)

Research-backed patterns to adopt ([dev.to HITL](https://dev.to/omnithium/human-in-the-loop-patterns-for-high-stakes-ai-agent-decisions-1fg6), [permit.io](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo), [hatchworks agent UX](https://hatchworks.com/blog/ai-agents/agent-ux-patterns/)):

- **Batch review from day one** — group similar actions; bulk approve/reject.
- **Anti-rubber-stamping:** required rejection/approval reasons; **canary injections**
  (deliberately wrong proposals; measure catch rate); reviewer-attention metrics.
- **Tiered review** by risk × confidence with SLAs (standard/elevated/escalation).
- **Full context chain** per proposal: evidence pack, agent reasoning, upstream steps,
  risk level, guardrail results — "the reviewer sees the complete picture."
- Decision history view (who approved what, when, why) + per-reviewer stats.
- Empty states that teach; keyboard-driven review ergonomics (<30s/action target).

### Lane D — Intelligence architecture

Target engine (extends, doesn't replace, current runtime):
`SQL facts → signal scoring → retrieval (qualitative only) → proposal generation with
mandatory evidence → risk classifier → confidence calibration → policy gate (tiered) →
ledger → outcome capture → eval store → policy/prompt tuner (human-approved changes)`.
What makes proposals smarter than an LLM wrapper: (a) deterministic facts first, (b) evidence
mandatory, (c) **confidence scores calibrated against historical approval outcomes**, (d)
per-segment learned priors from the flywheel, (e) every prompt/policy change gated by the
eval harness (CI-blocked regressions — [langchain evals](https://www.langchain.com/articles/llm-evals)).

### Lane E — Evals & benchmarks ("prove we're better than Alta")

Per production-agent practice ([TDS 12-metric harness](https://towardsdatascience.com/building-an-evaluation-harness-for-production-ai-agents-a-12-metric-framework-from-100-deployments/), [Anthropic on agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), [confident-ai](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide)):

- **Offline:** golden dataset of accounts/contexts with expected proposal properties; rubric
  scores (evidence coverage, targeting fit, spamminess); CI gate fails the build on regression.
- **Online:** approval rate, edit rate, rejection-reason distribution, false-positive rate,
  idempotent-execution rate (target: 1.0), canary catch rate, reviewer time/action,
  time-to-first-approved-action, operator-trust survey (SUS-style), zero PII-leak scans.
- **LLM-as-judge at scale + 1–2% human calibration sample.** Eval records stored = audit trail
  (doubles as SOC 2 evidence — direct synergy with our control matrix).
- **Headline public benchmarks vs Alta:** evidence coverage 100% (mechanical), duplicate
  executions 0 (tested), approval rate ≥70% by day 30 of a tenant, TTFA <30 min from connect.

### Lane F — Security/governance as product

Already differentiated (proven RLS, ledger, kill switch, evidence checklist). Productize:
self-serve **audit-pack export** (per-contact/tenant action chains), customer-visible control
status page, per-action-type policy editor (tenant-configurable approval rules as data),
canary + attention metrics as a _governance feature_, SOC 2 Type 1 → public trust center.

### Lane G — HubSpot-native depth (post-alpha, still no email)

Highest-leverage extensions after tasks/notes:

1. **Provenance properties** on every created object (`cognitia_run_id`, `cognitia_evidence`,
   `cognitia_approved_by`, console deep-link) — the visible moat.
2. Richer read sync: owners, pipelines/stages, activity timeline, lifecycle stage → better
   targeting context.
3. Approval-gated **stage updates** (CRM-2) with per-tenant stage mapping + fail-safe.
4. HubSpot **Marketplace listing** (distribution; Alta is there, we must be).
5. Reports: a Cognitia-generated HubSpot dashboard of agent-sourced tasks/outcomes.
6. Timeline events for decisions (HubSpot timeline API) — provenance in the rep's feed.

### Lane H — Packaging & pricing

Market: opaque platform fees (Alta $1–3k/mo), rare-and-disputed outcome pricing, hidden costs
1.5–2x sticker, mid-tier $1–2.5k = best value ([prospeo pricing](https://prospeo.io/s/ai-sdr-pricing-comparison), [devcommx](https://www.devcommx.com/blogs/ai-sdr-pricing), [joinvalley ROI](https://www.joinvalley.co/blog/ai-sdr-pricing-costs-roi-2026)).
**Cognitia:** transparent flat platform fee per tenant (launch ~$750–1,500/mo, public page),
no per-action credits (anti-Breeze), no per-outcome disputes; design partners: free/heavily
discounted 90 days for case-study + dataset rights; enterprise tier adds SSO/SAML, audit-pack
export, custom policies, dedicated infra. **"Why now":** "After 11x, you need agents you can
audit. We're the system that proves every action."

---

## 3. Gap analysis: current branch vs ideal system

| Capability                               | Current (35cdae1)             | Ideal                                             | Gap size          |
| ---------------------------------------- | ----------------------------- | ------------------------------------------------- | ----------------- |
| Action ledger, idempotency, audit events | ✅ proven                     | + customer-facing export                          | S                 |
| Approval flow                            | ✅ binary approve/reject      | reasons required, batch, tiers, canaries, history | M                 |
| Decision data capture                    | ⛔ reasons not captured       | every decision = labeled datum (flywheel)         | **S but urgent**  |
| Provenance in HubSpot                    | ⛔ idempotency key only       | run-id/evidence/approver properties + timeline    | S–M               |
| Confidence on proposals                  | ⛔ none                       | calibrated confidence → tiered review             | M                 |
| Eval harness                             | 🟫 stubs                      | golden dataset + CI gate + online metrics         | M                 |
| Trust metrics/dashboard                  | ⛔ basic counts               | approval rate, TTFA, dup-rate, canary catch       | M                 |
| Autonomy model                           | fixed (all manual)            | earned, graduated, per action-type×segment        | M–L               |
| Context richness                         | accounts/contacts/deals basic | owners, pipelines, activity, lifecycle            | M                 |
| Distribution                             | none                          | HubSpot Marketplace listing                       | M (process-heavy) |

## 4. Prioritized roadmap

**Post-alpha immediate (V1.1, ~2 weeks)** — start the flywheel before the first partner click:
FLY-1 (decision reasons → labeled data), PROV-1 (provenance properties), UX-2 (batch +
decision history), MET-1 (trust metrics endpoint + console strip).
**30 days:** EVAL-1 (golden dataset + CI gate), INT-1 (confidence + tiered review), LEARN-1
(per-segment scorecards feeding Mira), SYNC-2 (richer HubSpot read context); Marketplace
listing process started.
**60 days:** trust dashboard (customer-visible), canary injections + attention metrics,
policy editor v1 (tenant rules as data, human-approved changes), CRM-2 stage updates;
SOC 2 Type 1 closing.
**90 days:** earned-autonomy tier 1 (batch-approve unlock by measured thresholds) behind
explicit tenant opt-in + policy gate; email channel work begins **per the existing Gate-2
plan only** (separate fence decision — not smuggled in); Salesforce evaluation spike.
**Platform bets (later):** governed-action-layer as API (third-party tools submit proposals
through our ledger/policy/approval), vertical playbook packs (MoverOS-style), multi-CRM.

## 5. Target architecture (delta view)

Keep: events ledger, ActionLedger, PolicyGate, RLS/tenancy, adapters, fence mechanism.
Add (each isolated, additive):

- `decision` enrichment on approve/reject (reason, edit-diff ref) → `feedback_labels`.
- `proposal_confidence` on agent_actions + calibration job.
- `review_tiers` policy table (risk × confidence → tier/SLA/batch-allowed).
- `eval_runs` wired to CI + online metric emitters (`trust.metric.*.v1` events).
- HubSpot provenance writer (extra properties on create; timeline events).
- `autonomy_grants` (tenant × action_type × tier, thresholds, granted_by, revocable) —
  **default = current behavior; nothing auto-executes without an explicit grant.**

## 6. Console UX evolution (post-UI-1)

v1.1: reason-required reject (and optional approve note); batch select+approve; decision
history tab; per-row "why" expander (evidence + guardrails + risk).
v2 (30–60d): tiered queues with SLAs; keyboard review flow; canary indicators (admin);
trust strip (approval rate, TTFA, dup=0); diff view for edited proposals.
v3 (90d): autonomy-grant management UI; per-segment quality explorer; audit-pack export button.

## 7. Benchmark/evals plan — see Lane E. Operational targets:

evidence coverage 100% · dup executions 0 · approval rate ≥70% @ day 30 · reviewer time
<30s/action · canary catch ≥90% · TTFA <30 min · PII leaks 0. Published quarterly.

## 8. Implementation tickets (sequenced)

| #   | Ticket                                                       | Size | Depends       | Notes                                                      |
| --- | ------------------------------------------------------------ | ---- | ------------- | ---------------------------------------------------------- |
| 1   | **FLY-1** required decision reasons → feedback_labels        | S    | —             | the flywheel's first datum; ship before partner onboarding |
| 2   | **PROV-1** HubSpot provenance properties on created objects  | S    | CRM-1 live    | extra properties via existing client                       |
| 3   | **UX-2** batch approve/reject + decision history view        | M    | FLY-1         |                                                            |
| 4   | **MET-1** trust metrics endpoint + console strip             | S–M  | —             | approval rate, TTFA, dup-rate                              |
| 5   | **EVAL-1** golden dataset v1 + CI eval gate                  | M    | —             | rubrics exist; wire harness                                |
| 6   | **INT-1** proposal confidence + tiered review config         | M    | EVAL-1        | calibrate vs approvals                                     |
| 7   | **LEARN-1** per-segment scorecards → Mira targeting          | M    | FLY-1, EVAL-1 |                                                            |
| 8   | **SYNC-2** richer HubSpot read context                       | M    | —             | owners/pipelines/activity                                  |
| 9   | **CRM-2** stage updates (approval-gated, fail-safe mapping)  | M    | SYNC-2        |                                                            |
| 10  | **AUTON-1** earned-autonomy grants (opt-in, threshold-gated) | L    | 1–7           | spec first; never default-on                               |

## 9. Must / optional / not-worth

**Must (next release):** FLY-1, PROV-1, UX-2, MET-1, EVAL-1.
**Valuable optional:** INT-1, LEARN-1, SYNC-2, CRM-2, Marketplace listing, trust dashboard.
**Not worth doing:**

- **LinkedIn automation** — externally validated dead end (Artisan restricted; Alta's own
  reviewers call it unstable). Keep fenced permanently unless official APIs change.
- **Voice** now — TCPA liability + category trust deficit; revisit post-enterprise traction.
- **Per-outcome pricing** — vendor-defined "qualified" disputes (research-confirmed).
- **Building an enrichment marketplace** — license data instead; the failed tools died on
  data quality they pretended to own.
- **Multi-CRM before HubSpot depth wins** — depth is the moat; breadth is Alta's game.
- **Chat-first UX** — queue/review surfaces beat chat for operator work (agent-UX research).

## 10. Final recommendation — top 3 defensible moves

1. **Ship the approval-decision flywheel (FLY-1) before the first design partner clicks** —
   every day of alpha then compounds into a labeled dataset competitors structurally lack.
2. **Decision provenance inside HubSpot (PROV-1)** — visible-in-CRM auditability; cheap to
   build on the existing client; expensive for autopilot-architected competitors to retrofit.
3. **Publish trust benchmarks (EVAL-1 + MET-1)** — make "prove it" the buying criterion the
   whole category fails, and we pass by construction.
