# Competitive Moat Roadmap — Cognitia / Demandara

> **Document owner:** Competitive Moat Controller
> **Status:** Strategy baseline (living document)
> **Position in one line:** Cognitia becomes a **Proof-Governed GTM OS** —
> Alta-class GTM execution fused with Kite-class scoped agent accountability,
> without public token / payment complexity.

---

## 0. Read This First — Scope Guardrails

This document is a **strategy artifact**, not a build spec. It contains no
product code. Everything below is constrained by hard rules that override any
competitive temptation:

- **Client Zero = dealership / Auto Growth OS.** Every roadmap milestone is
  measured against whether it moves Client Zero.
- **MoverOS is _not_ Client Zero.** It is a later, adjacent vertical.
- **Cognitia is not a video / avatar company.** Generated media is at most a
  garnish on proof, never the product.
- **No live outreach** of any kind (SMS, calls, WhatsApp, LinkedIn automation,
  email blasts, ads, vendor calls) and **no real prospect data** appear in any
  milestone. All execution is simulated, sandboxed, or human-gated.
- **No public token / chain / payment surface.** No chain deployment,
  liquidity, listing, presale, airdrop, yield, or investment language.
- **Agent Economy / token-lab / crypto stays parked.** It is referenced only as
  a future, internal-research option behind a wall (see §7).

If a future contributor reads a section that seems to invite a blocked surface,
the **Blocked Surfaces** table in §7 wins.

---

## 1. Alta Capability Map

Alta positions itself as an autonomous, AI-native GTM / revenue platform. Its
moat is **breadth of execution under one roof** with named agent personas
fronting a workflow + CRM + analytics stack.

### 1.1 Agent personas

| Persona   | Function (as positioned)                                                                       | What it really is                                                                   |
| --------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Katie** | "Chief Revenue Officer" agent — strategy, prioritization, pipeline narrative, account planning | An orchestration/reasoning layer over CRM + analytics that frames _what to do next_ |
| **Alex**  | SDR / outbound execution agent — sequencing, prospect research, drafting, follow-up cadence    | An execution layer that turns plans into outbound motion                            |
| **Luna**  | Inbound / conversation + qualification agent — responds, qualifies, books, routes              | A real-time responder bound to inbound channels and routing rules                   |

The persona pattern matters more than the names: Alta sells **role-shaped
agents** (a strategist, a closer-feeder, a responder) rather than a generic
"AI assistant." Buyers map them onto an org chart.

### 1.2 Workflows

- Multi-step GTM sequences (research → draft → send → follow-up → handoff).
- Trigger-based automation (signal detected → action taken).
- Human-in-the-loop checkpoints positioned as optional, not foundational.
- Cross-persona handoffs (Katie plans → Alex executes → Luna catches reply).

### 1.3 CRM

- Native or tightly-integrated CRM as the system of record.
- Contact / account / opportunity objects with AI-maintained enrichment.
- Activity timeline that the agents both read from and write to.

### 1.4 Analytics

- Pipeline and funnel reporting.
- Agent-attributed activity ("what the AI did and what it produced").
- Forecast / health narratives generated on top of the raw numbers.

### 1.5 Enterprise controls

- Roles / permissions, team structures.
- Brand / messaging guardrails for generated content.
- Integrations with existing stacks (email, calendar, data providers).
- Audit-style visibility into agent activity (positioned as trust, but
  reporting-grade, not cryptographic-grade).

### 1.6 Alta's structural weakness

Alta optimizes for **volume of autonomous action**. Its accountability story is
**reporting after the fact**: dashboards that say what happened. There is no
hard, tamper-evident contract that says _this agent was allowed to do exactly
this, and here is the signed evidence it stayed inside the line._ That gap is
the seam Cognitia attacks.

---

## 2. Kite AI Capability Map

Kite's contribution to the landscape is **agent accountability primitives** —
identity, scope, and evidence for what an agent did. We adopt the _governance
shape_ and explicitly reject the _public-chain / payment_ shape.

| Kite primitive        | What it does                                                                                    | Cognitia's stance                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Agent Passport**    | Verifiable identity for an agent — who it is, who owns it, what it's authorized for             | **Copy the concept.** Build an internal Agent Passport: signed identity + owner + authorized scope. No public chain. |
| **Scoped sessions**   | Time-boxed, permission-bounded execution windows — an agent can only act within a granted scope | **Copy and surpass.** Every Cognitia agent action runs inside a scoped session with explicit, revocable limits.      |
| **Receipts**          | Tamper-evident records of what an agent did inside a session                                    | **Copy and surpass.** Receipts become the core artifact — every meaningful action emits a signed receipt.            |
| **Payment protocols** | Agent-to-agent / agent-to-service payment rails (token-mediated)                                | **Reject for now.** No payment rail, no token, no settlement. Parked behind the wall in §7.                          |
| **Service protocols** | Standardized agent-to-service interaction contracts                                             | **Adapt internally only.** Use the contract idea for internal tool calls; no public marketplace.                     |

### 2.1 Kite's structural weakness (for our purposes)

Kite couples accountability to a **public economic substrate** (chain + token +
payments). That substrate is exactly the complexity and risk we are mandated to
avoid. The valuable kernel — **passport, scope, receipt** — does not require any
of it. We extract the kernel and leave the substrate.

---

## 3. Cognitia Response — The Proof-Governed GTM OS

### 3.1 The thesis

> Alta makes agents **do** GTM work.
> Kite makes agents **accountable**.
> Cognitia makes GTM work that is **provable** — every agent action is scoped
> before it happens and receipted after, so the output is not just "done" but
> "done within authorized limits, with evidence."

We are not racing Alta on autonomous volume, and we are not racing Kite on
crypto rails. We win on a dimension neither owns end-to-end: **proof-governed
execution** — the marriage of GTM execution and cryptographic-grade
accountability, packaged for a real operator (Client Zero) instead of a
developer or a token holder.

### 3.2 The three pillars

1. **Scope-before-action (Passport + Scoped Session).**
   No agent does anything without a passport establishing identity/ownership and
   a scoped session establishing exactly what it may touch, for how long, and
   under what limits. Scope is granted by a human and is revocable.

2. **Receipt-after-action (Proof Ledger).**
   Every meaningful action emits a signed, tamper-evident receipt: what was
   attempted, under which scope, what the result was, and who/what approved it.
   Receipts chain into an internal Proof Ledger. This is the artifact a
   dealership GM, a compliance reviewer, or an auditor actually trusts.

3. **Role-shaped GTM agents (Alta-pattern, proof-bound).**
   We adopt Alta's role-shaped persona pattern — a strategist, an executor, a
   responder — but every persona is born inside the Passport/Scope/Receipt
   harness. They cannot act outside proof. The personas are a UX for the
   operator; the proof is the moat.

### 3.3 Why this is a moat, not a feature

- **Hard to copy from Alta's side:** retrofitting cryptographic-grade scope and
  receipts onto a volume-optimized autonomy engine is an architecture change,
  not a feature toggle.
- **Hard to copy from Kite's side:** delivering a polished, operator-facing GTM
  OS for a real vertical (dealerships) is a product/GTM problem Kite is not
  built to solve.
- **Compounding asset:** the Proof Ledger accrues value over time — it becomes
  the system of record for _trust_, which is sticky and switching-cost-heavy.

---

## 4. Copy / Reject / Surpass

### 4.1 Copy (steal the pattern, ship faster)

- **Role-shaped agent personas** (from Alta). Operators buy an org chart, not an
  "assistant." Ship a strategist persona, an executor persona, a responder
  persona — Cognitia-named, proof-bound.
- **Workflow chaining with human checkpoints** (from Alta) — but checkpoints are
  _foundational and non-optional_, not a setting.
- **Agent Passport, Scoped Sessions, Receipts** (from Kite) — the accountability
  kernel, rebuilt internally with no public substrate.
- **Service-contract framing for tool calls** (from Kite) — internal only.

### 4.2 Reject (do not build, do not imply)

- **Any public token / chain / payment rail** (from Kite). No settlement, no
  marketplace, no economic substrate. Parked (§7).
- **Optional / cosmetic human-in-the-loop** (from Alta). We do not ship
  "autonomy you can trust because the dashboard says so."
- **Volume-first autonomous outreach** (from Alta). We are explicitly not an
  outreach blaster. No live channels (§7).
- **Generic "do everything" assistant positioning.** We are a GTM OS for a
  named vertical.
- **Video / avatar as a product line.** Not who we are.

### 4.3 Surpass (where we go beyond both)

- **Proof Ledger as the system of record for trust.** Neither Alta (reporting)
  nor Kite (public receipts tied to chain) delivers an operator-facing,
  private, tamper-evident ledger purpose-built for a vertical. We do.
- **Scope-before-action as a hard gate, not advisory.** Surpass Alta's
  after-the-fact reporting by making authorization a precondition.
- **Operator-grade proof UX.** A dealership GM can read "what did the agent do,
  was it allowed, prove it" in seconds. Surpass Kite's developer/chain-grade
  ergonomics with vertical-grade ergonomics.
- **Vertical depth for Client Zero.** Surpass Alta's horizontal breadth with a
  dealership-specific motion that is provable end to end.

---

## 5. Immediate Client Zero Implications (Dealership / Auto Growth OS)

Client Zero is a dealership running Auto Growth OS. The Proof-Governed GTM OS
must show value to a **GM / owner** who cares about pipeline, compliance, and
not getting burned by an automated system doing something it shouldn't.

### 5.1 What lands first

- **Proof-governed lead handling (simulated).** A responder persona handles
  inbound lead scenarios _in a sandbox / on synthetic or human-supplied test
  data only_ — every step scoped and receipted. No live channels. The
  deliverable is the **receipt trail**, not the message volume.
- **Scoped workflows for the dealership motion.** Map the dealership GTM motion
  (inquiry → qualify → route → follow-up plan) into scoped sessions with human
  checkpoints. The GM grants and revokes scope.
- **The Proof Ledger view.** The single most important Client Zero artifact: a
  view the GM trusts that answers "what did the system do, was it authorized,
  show me the evidence."

### 5.2 What Client Zero must NOT see

- No live outreach firing to real prospects. Ever, in this phase.
- No real prospect PII flowing into demos — synthetic / consented test data
  only.
- No token, payment, or investment language anywhere in the dealership-facing
  surface.
- No avatar/video pitch as the headline.

### 5.3 The Client Zero proof point

Success = a dealership operator says: _"I can see exactly what the AI did, I
granted it that permission, and I have the receipts."_ That sentence is the
moat made tangible.

---

## 6. Roadmap

All milestones are constrained by §0 and §7. "Simulated" / "sandboxed"
means no live channels and no real prospect data.

### 6.1 90-Day Horizon — _Prove the kernel on Client Zero_

**Objective:** Stand up the Passport / Scope / Receipt kernel and make one
dealership motion provable end to end, in a sandbox.

- Define the **Agent Passport** model (identity, owner, authorized scope) —
  internal, no public substrate.
- Define **Scoped Session** semantics (grant, limits, expiry, revocation,
  human checkpoint).
- Define the **Receipt** format and the **Proof Ledger** append/verify model.
- Build **one role-shaped persona** (the responder) bound to the kernel,
  operating on synthetic dealership lead scenarios.
- Ship the **Proof Ledger view** that a dealership GM can read.
- **Exit criteria:** a GM can replay a sandboxed dealership scenario and verify,
  from receipts alone, that every action was scoped and authorized.

### 6.2 12-Month Horizon — _Become the operator's system of trust_

**Objective:** Expand from one provable motion to a coherent, proof-governed
GTM OS for the dealership vertical.

- Add the **strategist** and **executor** personas, all proof-bound.
- Cover the full sandboxed dealership GTM motion under scoped workflows with
  mandatory human checkpoints.
- Mature the **Proof Ledger** into the operator's system of record for trust
  (search, replay, export, attestations).
- Add **enterprise controls** (roles, scope policies, brand/messaging
  guardrails) — Alta-class, but enforced through proof.
- Introduce **analytics over the Proof Ledger** — not just "what happened" but
  "what was authorized vs. attempted vs. delivered."
- Carefully evaluate **controlled, human-gated activation** of a single real
  surface only if and when guardrails (§7) and explicit authorization permit —
  default remains simulated.
- **Exit criteria:** Client Zero runs its GTM motion through Cognitia and treats
  the Proof Ledger as the source of truth for accountability.

### 6.3 24-Month Horizon — _Platform & second vertical_

**Objective:** Generalize the proof-governed pattern beyond Client Zero and
harden the moat.

- Generalize the kernel into a **proof-governed GTM platform** that can host new
  verticals without re-architecting.
- Onboard a **second vertical** (candidate: MoverOS — explicitly _not_ Client
  Zero, sequenced after dealership proof is durable).
- Deepen the **Proof Ledger** as a defensible, compounding trust asset
  (cross-session lineage, long-horizon attestations, third-party verifiability
  that requires no public chain).
- Evaluate (behind the wall, §7) whether any parked Agent-Economy concepts have
  a _governed, non-public_ internal application — research only, no public
  surface.
- **Exit criteria:** Cognitia is recognized as the Proof-Governed GTM OS — the
  category neither Alta nor Kite occupies — with two provable verticals and a
  trust ledger competitors cannot quickly replicate.

---

## 7. Blocked Surfaces (Explicit)

These are hard blocks. They override any roadmap item, competitive pressure, or
contributor initiative. If a task seems to require one of these, stop and
escalate.

| Surface                            | Status                   | Note                                                             |
| ---------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| Live outreach — SMS                | **BLOCKED**              | No live sends. Sandbox/simulated only.                           |
| Live outreach — calls              | **BLOCKED**              | No dialing, no voice automation.                                 |
| Live outreach — WhatsApp           | **BLOCKED**              | No live messaging.                                               |
| Live outreach — email blasts       | **BLOCKED**              | No campaign sends.                                               |
| LinkedIn automation                | **BLOCKED**              | No scraping, connecting, or messaging.                           |
| Paid ads                           | **BLOCKED**              | No ad buying or ad automation.                                   |
| Vendor calls / live vendor contact | **BLOCKED**              | No outbound to vendors.                                          |
| Real prospect data / PII           | **BLOCKED**              | Synthetic / consented test data only.                            |
| Public token                       | **BLOCKED**              | No issuance, no public token of any kind.                        |
| Chain deployment                   | **BLOCKED**              | No public chain, no on-chain deployment.                         |
| Liquidity / listing                | **BLOCKED**              | No exchange, listing, or liquidity work.                         |
| Presale / airdrop                  | **BLOCKED**              | No distribution events.                                          |
| Yield / investment language        | **BLOCKED**              | No financial-return framing anywhere.                            |
| Payment / settlement rails         | **BLOCKED**              | No agent payment, no settlement.                                 |
| Agent Economy / token-lab / crypto | **PARKED**               | Internal research only, behind the wall. Never a public surface. |
| Video / avatar as product line     | **BLOCKED (as product)** | At most garnish on proof; never the product.                     |
| MoverOS as Client Zero             | **BLOCKED**              | Client Zero is the dealership. MoverOS is a later vertical.      |

### 7.1 Escalation rule

Any work that touches a **BLOCKED** row must not proceed. Any work that touches
a **PARKED** row stays internal, non-public, and research-only. When in doubt,
treat the stricter interpretation as binding and raise it with the Competitive
Moat Controller.

---

## 8. One-Page Summary

- **Category we own:** Proof-Governed GTM OS.
- **Formula:** Alta-class execution + Kite-class accountability − public
  token/payment complexity.
- **Kernel:** Agent Passport → Scoped Session → Receipt → Proof Ledger.
- **Pattern borrowed from Alta:** role-shaped personas + workflows, with
  human checkpoints made foundational.
- **Pattern borrowed from Kite:** passport / scope / receipt, rebuilt with no
  public substrate.
- **Moat:** the Proof Ledger — a private, tamper-evident system of record for
  _trust_, vertical-tuned for Client Zero.
- **Client Zero:** dealership / Auto Growth OS. Everything simulated; the
  deliverable is the receipt trail, not message volume.
- **Hard line:** no live outreach, no real prospect data, no public
  token/chain/payment. Agent Economy stays parked.
