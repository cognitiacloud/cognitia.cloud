# Future-Proofing R&D Map

**Status legend:** REAL (shipped/working) · SANDBOX (isolated experiment) · PLANNED (intended, not built) · MOCK (placeholder/fixture) · PARKED (deliberately deferred; not to be built until gated).

**Repo reality check (2026-06-22):** This repository is effectively greenfield. The only directory present is `hermes/`. Everything described in this document is **PLANNED** or **PARKED** R&D. Nothing here is implemented, and nothing in this document should be read as a production-readiness claim. No tokens, no blockchain, no payments, no public fundraising claims appear in scope.

---

## 1. Purpose

This map answers three questions for the Cognitia / Demandara program:

1. **What do we build now** (small, cheap, verifiable code)?
2. **What do we keep as docs + spec** (designed on paper, validated by review, not coded)?
3. **What do we park** (deferred behind explicit gates until real pilots exist)?

The organizing thesis is the **durable moat**: even in a world of cheap, abundant agents and increasingly capable models, the scarce and defensible assets are **proof, consent, reputation, and replayability** — not the software itself.

---

## 2. Build now / docs+spec / park

### 2.1 Build now (REAL or SANDBOX, small surface)

These are cheap, self-contained, and create compounding evidence value. They do not touch payments, identity, or live customer systems.

| Item | Status target | Why now | Boundary |
|---|---|---|---|
| **Proof receipt schema** (a signed, append-only record of "what the agent did, on whose behalf, with what consent, and what the result was") | SANDBOX → REAL (schema + validator only) | Foundational to every other moat. Cheap to define; high leverage. | Schema and local validation only. No external signing authority, no chain. |
| **Replay harness** (deterministic re-execution of a recorded run against fixtures) | SANDBOX | Turns "trust us" into "watch it again." Differentiator vs. opaque agents. | Runs only against MOCK/SANDBOX data. No live re-execution against third parties. |
| **Consent gate primitive** (a check that an authorizing record exists and is in-scope before an action runs) | SANDBOX | Core compliance-native building block. | Local policy check; no real authority store yet. |
| **TrustOps event log** (structured, queryable log of agent decisions and gate outcomes) | SANDBOX | Feeds analytics, disputes, and reputation later. | Local/sandbox storage; no PII; `.example`/`.invalid` fixtures only. |
| **Dispute/replay pack exporter** (bundle a receipt + inputs + replay script into a portable artifact) | SANDBOX | Makes disputes mechanical instead of rhetorical. | Export of sandbox data only. |

### 2.2 Keep as docs + spec (PLANNED — design, review, do not code yet)

These benefit from being fully specified and adversarially reviewed before any code exists. Specifying them now de-risks later builds and lets us validate demand with diagrams instead of deployments.

- **Alta-style GTM system** (agentic go-to-market orchestration: research → targeting → outreach drafting → handoff). Spec the *workflow and gates*; do not wire live outreach automation.
- **SalesCloser-style live sales agent** (real-time conversational sales support). Spec the *consent, recording, and disclosure model* first.
- **Agent authorization protocol adapters** (how an external "this agent may act for me" grant would be verified). Spec the verification interface; do not implement any specific protocol or issue grants.
- **TrustOps analytics layer** (dashboards over the event log: gate pass rates, dispute frequency, replay fidelity).
- **Compliance-native workflow templates** (per-vertical: what must be disclosed, retained, consented).
- **Vertical SaaS replication playbook** (how one proven vertical becomes a template for the next).

### 2.3 Park (PARKED — do not build until gated)

These are documented as future direction only. They are explicitly **out of build scope** until real pilots and external review clear them. See `agent-commerce-readiness.md` for the full parked-scope contract.

- **Agent identity** (durable cryptographic identity for an agent acting in commerce).
- **Agent wallet** (any value-holding or value-moving capability).
- **Payments / settlement** (any movement of money, credits, or transferable value).
- **Any token, chain, or on-ledger mechanism.** Banned from implementation entirely in this program phase.

---

## 3. The durable moat thesis

**Premise:** Assume the pessimistic-for-incumbents case — models get cheaper, agents get more capable, and "write me software that does X" becomes nearly free. In that world, the *application* is commoditized. What is *not* commoditized:

1. **Proof.** A buyer (human or agent) needs to know an action actually happened, as described, and can be evidenced after the fact. Cheap agents make *claims* abundant and *trustworthy claims* scarce. A verifiable proof receipt is a scarce good.

2. **Consent.** As agents act on behalf of people and businesses, the binding question becomes "was this authorized, and in scope?" Consent gates — checked, logged, and replayable — are a regulatory and trust necessity that commodity agents skip.

3. **Reputation.** When anyone can spin up an agent, *track record* becomes the filter. Reputation is built from a history of proven, consented, undisputed actions — i.e., it is *derived from* proof and consent. It cannot be cloned by copying code.

4. **Replayability.** The ability to deterministically reproduce "what happened" converts disputes from he-said/she-said into mechanical verification. This is expensive to retrofit and cheap to design in from day one.

**Why this is a moat and not just a feature:** Proof, consent, reputation, and replay are *accumulating* and *non-copyable*. A competitor can copy our UI in an afternoon with a model; they cannot copy two years of accumulated, verifiable, undisputed track record, nor the trust relationships and compliance posture built on top of it. The software is the cheap part; the **evidence graph** is the moat.

**Corollary (honesty note):** This thesis is a *bet*, not a proven fact. It assumes buyers will pay a premium for verifiability and that regulation/market pressure rewards consent. Both assumptions must be validated cheaply (Section 4) before heavy investment.

---

## 4. Research bets and cheap validation

Each bet is stated as a falsifiable hypothesis with a low-cost validation method. The goal is to spend documents and small experiments, not deployments.

| # | Bet (hypothesis) | Cheap validation | Kill / pivot signal |
|---|---|---|---|
| B1 | Buyers value a verifiable **proof receipt** enough to prefer/pay for it. | Mockup-based interviews: show a sample receipt + replay; measure stated willingness and which fields matter. | No one can articulate what they'd do with a receipt. |
| B2 | **Replay** meaningfully reduces dispute-resolution cost. | Tabletop exercise: run a fake dispute with and without a replay pack; time and compare. | Replay doesn't change the outcome or speed. |
| B3 | **Consent gates** are seen as enabling (not just friction) by compliance-minded buyers. | Spec review with 2–3 domain reviewers in a target vertical. | Reviewers see only overhead, no value. |
| B4 | A **GTM workflow** (Alta-style) is more trusted *because* of proof/consent, not despite it. | Concept test: two storyboards (with vs. without visible proof), measure preference. | Proof is irrelevant to GTM buyers. |
| B5 | **Reputation derived from proven actions** is a credible buying signal. | Paper design + interview: would buyers weight a "proven track record" score? | Buyers ignore track record in favor of price/brand. |
| B6 | One vertical's **compliance-native template** transfers to a second vertical with modest edits. | Author template for vertical A, dry-run map it onto vertical B on paper. | Templates are fully bespoke; no transfer. |
| B7 | A neutral **agent-authorization verification interface** is implementable across ≥2 emerging protocols. | Spec-only conformance matrix comparing 2–3 landscape protocols against our interface. | No common shape; interface would be a fiction. |

**Validation budget rule:** No bet graduates to "build now" until it has at least one passing cheap validation *and* clears the boundary rules (no payments/identity/chain). Bets B1–B3 are the priority order; they underpin everything else.

---

## 5. Risk register (R&D-level)

| Risk | Type | Mitigation |
|---|---|---|
| Moat thesis is wrong; buyers don't pay for proof. | Market | Validate B1/B2/B5 before heavy build. |
| Scope creep into payments/identity/chain. | Boundary | Hard ban; PARKED contract in `agent-commerce-readiness.md`; gates required. |
| Replay/receipt design leaks PII. | Privacy | Sandbox + synthetic data only (`.example`/`.invalid`, `555-01xx`); no raw PII ever. |
| Authorization-protocol landscape shifts under us. | Technical | Build a *verification interface*, not a protocol; stay adapter-shaped. |
| Over-investing in vertical A before transfer is proven. | Strategy | Require B6 before replicating. |
| Treating PLANNED docs as production claims. | Communication | Status tags on every material claim; no readiness language. |

---

## 6. How to read the rest of this set

- **`agent-commerce-readiness.md`** — how proof/consent map to agent-commerce, the authorization landscape, and the explicit PARKED contract (banned scope + banned hype language).
- **`12-month-moat-roadmap.md`** — the quarter-by-quarter plan with deliverables, build-now/spec/parked tags, the moat each item deepens, dependencies, and kill/park criteria.

---

*This document is research and planning only. No production-readiness is claimed or implied.*
