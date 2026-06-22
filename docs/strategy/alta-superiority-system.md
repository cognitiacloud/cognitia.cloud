# Alta Superiority System — Narrative Blueprint

> **Status banner:** This is a **GREENFIELD BLUEPRINT / SPEC**. As of 2026-06-22 the
> `cognitia.cloud` repository contains only `hermes/skills/`. **Nothing described as a
> Cognitia capability below is built yet.** Almost every material claim is tagged
> **PLANNED**. This document defines *what must be built, in what order, and with what
> proof* to move "Alta-class GTM parity" from an honest **34/100** toward a credible
> **80+ PATH**. It is not a claim of production readiness, and it contains no
> authorization to take any live action.
>
> **Claim tags used throughout:** `REAL` (exists and verifiable today) ·
> `SANDBOX` (exists only in the `budget_wheels_demo` / Tenant Zero sandbox) ·
> `PLANNED` (designed, not built) · `MOCK` (fixture/stub only).
>
> **Scope guardrails:** No live channel code. No live outreach (email / SMS / WhatsApp /
> calls / LinkedIn / ads). No live CRM sync. No vendor API calls against real accounts.
> No real customer or prospect PII — examples use `.example` / `.test` / `.invalid`
> domains and `555-01xx` phone numbers only. The only tenant referenced is
> `budget_wheels_demo` (Tenant Zero sandbox).

---

## 0. Purpose and the parity gap

"Alta" here means the **alta.ai-class GTM agent category**: a vendor that sells an
autonomous outbound agent, an inbound agent, revenue intelligence, and CRM-native
workflows as a single "AI go-to-market" platform. That category sets the **capability
bar**. Cognitia's thesis is *not* to match it feature-for-feature on autonomy; it is to
**reframe the category around proof and governance** — to ship GTM actions that are
consent-gated, human-approved, logged to an append-only ledger, and replayable on
demand.

Today Cognitia scores an honest **34/100** against the Alta-class bar. That number is
low because the repo is empty: there is capability *design* but almost no capability
*code*. This blueprint exists so the 34 is a starting line, not a ceiling. The companion
files quantify the path:

- [`gtm-system-capability-ledger.md`](./gtm-system-capability-ledger.md) — the
  capability-by-capability ledger with status and proof.
- [`gtm-system-90-day-build-map.md`](./gtm-system-90-day-build-map.md) — the tiered
  backlog, the 50 / 65 / 80+ score path, and 90-day sequencing.

---

## 1. Alta-class capability map (the bar to clear)

This is the category Cognitia is measured against. Each item below is an **Alta-class
expectation** — what the incumbent category foregrounds. Cognitia's own status for each
is tracked in the capability ledger; here we only describe the bar.

### 1.1 Outbound agent
An autonomous agent that builds target lists, researches accounts and contacts, drafts
personalized multi-step sequences, and sends across email and social channels with
follow-ups and reply handling — largely without per-message human review.

### 1.2 Inbound agent
An always-on responder that triages inbound replies, web-form fills, and chat; qualifies
intent; books meetings; and routes to humans only on exception. Speed-to-lead is the
headline metric.

### 1.3 Revenue intelligence
Pipeline scoring, deal-risk signals, forecast roll-ups, and "next best action"
recommendations derived from activity and CRM data. Sold as the analytics brain that
tells reps where to spend time.

### 1.4 Workflows
Configurable, branching automations (triggers → conditions → actions) that orchestrate
the outbound/inbound agents, enrichment steps, and CRM updates as repeatable plays.

### 1.5 CRM sync
Bi-directional, near-real-time sync with Salesforce / HubSpot: contacts, accounts,
opportunities, activities, and custom fields, treated as the system of record.

### 1.6 Data sources
Built-in or partnered access to contact/firmographic enrichment, intent signals, and
web/technographic data to feed targeting and personalization.

### 1.7 Analytics
Dashboards for sequence performance, reply/meeting rates, channel effectiveness, and
attribution — the operator's daily cockpit.

### 1.8 Enterprise controls
SSO, role-based access, audit logging, data-residency and retention controls,
deliverability/sending-domain management, and compliance posture (e.g. suppression
lists, opt-out handling) sufficient for an enterprise buyer's security review.

---

## 2. The Cognitia superiority layer (the differentiator)

Cognitia does not win by being *more autonomous*. It wins by wrapping every GTM action
in a **proof-and-governance envelope** that the Alta-class category does not foreground.
Each layer below is **PLANNED** unless tagged otherwise. Together they convert "the agent
did something" into "here is the consented, approved, logged, and replayable record of
exactly what was done and why."

### 2.1 Consent gate `PLANNED`
No outbound action targeting a contact may be *prepared for sending* unless a recorded
consent/permission basis exists for that contact and channel. The gate is a hard
precondition, not a setting: an action with no consent record cannot leave the draft
state. In the sandbox this is enforced against synthetic contacts only
(`*.example` / `555-01xx`).

### 2.2 Human approval `PLANNED`
Every channel-bound action requires an explicit human approval step before it could ever
be dispatched. The approver, timestamp, and the exact artifact approved are captured.
Auto-send is structurally impossible in the blueprint: the "send" capability is
deliberately not built and is **legal-gated** (see §4).

### 2.3 Action ledger `PLANNED`
An append-only, hash-chained log of every material event: list built, contact enriched,
draft generated, consent checked, approval granted/denied, dry-run executed. Entries are
immutable and ordered; tampering is detectable because each entry commits to the prior
entry's hash. This is the spine the other layers hang from.

### 2.4 Proof receipt `PLANNED`
For any action, the system can emit a self-contained **receipt**: what was done, to whom
(redacted/synthetic in sandbox), under what consent basis, approved by whom, with the
input/output artifacts and the ledger anchor. A receipt is the unit a buyer's auditor
can inspect.

### 2.5 Dispute / replay pack `PLANNED`
Given a disputed action, the system can assemble a **replay pack**: the full ordered
ledger slice, the artifacts, the consent and approval records, and a deterministic
re-run of the decision logic against the same inputs to show the same output would
result. This is the "show your work" capability incumbents lack.

### 2.6 Claim provenance `PLANNED`
Every personalization claim or research assertion the agent makes about an account/contact
is tagged with its source and retrieval time. A draft that says "they just raised a
Series B" must carry the provenance of that claim, so unsupported or stale claims are
flagged before approval.

### 2.7 Trust-weighted analytics `PLANNED`
Analytics are not just volume/rate dashboards. Every metric is weighted by the
*trust state* of its underlying actions: only consented, approved, provably-executed
actions count toward "verified" performance; everything else is segregated as
unverified. The cockpit reports performance *and* the integrity of the performance.

---

## 3. Why proof-governed GTM beats opaque autonomous GTM

The Alta-class pitch optimizes for **throughput and autonomy**: more messages, fewer
humans in the loop, faster. That is genuinely attractive — until the buyer's legal,
security, and brand teams ask the questions the category does not answer well:

1. **"Prove this contact consented."** Opaque autonomy treats consent as a checkbox or a
   suppression list. Proof-governed GTM treats it as a *hard gate with a record* — the
   action literally cannot proceed without it.
2. **"Who approved this exact message?"** Autonomy's value proposition is removing the
   approver. Cognitia's value proposition is *keeping a cheap, fast, fully-logged
   approver* so every dispatchable artifact has a named human owner.
3. **"Show me what happened in the deal we're being challenged on."** Incumbents can show
   activity timelines; few can produce a tamper-evident, deterministically-replayable
   pack. Cognitia's replay pack is built for exactly that conversation.
4. **"Where did that claim about our prospect come from?"** Autonomous personalization
   hallucinates plausibly. Claim provenance makes every assertion traceable or rejected.
5. **"How much of this 'performance' is real?"** Trust-weighted analytics refuse to count
   actions that weren't consented, approved, and proven — so the numbers survive scrutiny.

The strategic bet: as AI-GTM matures, **autonomy becomes a commodity and governance
becomes the differentiator**. Enterprise buyers will not deploy unaccountable outbound
agents against their brand and their prospects. The vendor that can make every action
*auditable by construction* wins the enterprise segment that incumbents struggle to
close. Cognitia is being built to be that vendor — and the proof layer is the moat,
because it is hard to retrofit onto a system designed for opaque autonomy.

This is also why the parity score is *honestly* 34 and not inflated: the governance moat
is mostly **PLANNED**, and we refuse to score design as if it were code.

---

## 4. Explicit blockers (what is not ours to unblock)

These are hard dependencies outside the engineering backlog. None of the live-action
capabilities can be honestly scored until each named owner clears the corresponding
blocker. **No work in this blueprint authorizes any live action.**

| # | Blocker | What it gates | Owner (to be assigned) | Status |
|---|---------|---------------|------------------------|--------|
| B1 | **Legal owner / DPA & compliance sign-off** | Any move from dry-run to live; consent-basis policy; data retention | Legal / Compliance lead | `PLANNED` — owner unassigned |
| B2 | **Customer consent** | Targeting any real contact on any channel | Customer (per-tenant) + Legal | `PLANNED` — sandbox uses synthetic contacts only |
| B3 | **Live deployment authorization** | Standing up any production sending/sync infra | Founder / Ops + Legal | `PLANNED` — no live infra exists |
| B4 | **CRM credentials** | Real bi-directional CRM sync (HubSpot / Salesforce) | Customer admin | `PLANNED` — sandbox uses MOCK CRM fixtures |
| B5 | **Channel approvals** | Sending domains, opt-out handling, platform ToS for email/SMS/social | Customer + channel vendors + Legal | `PLANNED` — no channels connected |

Until B1–B5 are cleared by their named owners, every channel-bound capability stays in
the **mock-safe** or **dry-run** tiers defined in the build map. The "send" path is
deliberately left unbuilt so that no accidental live action is possible.

---

## 5. How the three documents fit together

- **This file** — the *why* and the *what*: the category bar, the superiority layer, the
  argument, and the blockers.
- **Capability ledger** — the *where we stand*: every capability with an honest
  REAL/SANDBOX/PLANNED/MOCK status and the artifact that would prove it.
- **90-day build map** — the *how and when*: tiered backlog, the concrete checklists that
  raise parity to 50, 65, and 80+, and week-by-week sequencing with dependencies.

Read them in that order. The honest headline: Cognitia is at **34/100** today, with a
**defined, sequenced path** to 80+ that does not require — and explicitly forbids — any
live outreach until the legal and consent blockers are owned and cleared.
