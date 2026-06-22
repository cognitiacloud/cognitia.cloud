# GTM System — 90-Day Build Map & Score Path

> **Status banner:** **GREENFIELD BLUEPRINT / SPEC.** As of 2026-06-22 the repo contains
> only `hermes/skills/`. This is an *implementation backlog and parity-score path*, not a
> record of work done. Every backlog item is **PLANNED** until built. Nothing here
> authorizes a live action; the live tier is **legal-gated** behind blockers B1–B5.
>
> **Status legend:** `REAL` · `SANDBOX` · `PLANNED` · `MOCK`.
> **Guardrails:** No live channels/outreach/CRM sync/vendor APIs. Synthetic data only
> (`.example` / `.test` / `.invalid`, `555-01xx`). Only tenant: `budget_wheels_demo`.

Companion docs: [`alta-superiority-system.md`](./alta-superiority-system.md) ·
[`gtm-system-capability-ledger.md`](./gtm-system-capability-ledger.md).

---

## 1. Backlog in three tiers

The tiers encode *how safe* an item is to build now. Tier boundaries are hard: a Tier-3
item cannot be started until its blocker is cleared by the named owner.

### Tier 1 — Mock-safe now (no blocker; build immediately) `PLANNED`
Pure local/sandbox work over synthetic data with zero channel egress. No legal dependency.

- **T1.1** Repo + `docs/strategy` scaffold and this blueprint set. *(in progress)*
- **T1.2** Synthetic data fixtures: contacts/accounts using `.example` domains and
  `555-01xx` numbers; validation that **rejects** real-looking PII.
- **T1.3** Tenant Zero (`budget_wheels_demo`) sandbox config.
- **T1.4** Action ledger: append-only, hash-chained store + a chain-verification routine.
- **T1.5** Claim-provenance data model: claim → source → retrieval-time tagging.
- **T1.6** Dry-run execution engine skeleton: produces artifacts + ledger entries, no egress.
- **T1.7** Proof-receipt generator over ledger entries (synthetic actions).
- **T1.8** Consent-gate model: consent records as a hard precondition on draft→advance.
- **T1.9** Human-approval model: approver/time/artifact capture; no auto-advance.
- **T1.10** MOCK CRM fixture (read-only) for revenue-intelligence inputs.

### Tier 2 — Dry-run next (still no live egress; depends on Tier 1) `PLANNED`
Composes Tier-1 primitives into agent behaviors that *propose* actions but never send.

- **T2.1** Outbound agent: list build + research + draft, all consent-gated & provenance-tagged.
- **T2.2** Sequencing engine: multi-step dry-run sequences, per-step ledger entries.
- **T2.3** Inbound agent: triage/qualify synthetic inbound fixtures with logged decisions.
- **T2.4** Workflow engine: trigger→condition→action with per-node ledger entries.
- **T2.5** Dispute / replay pack: deterministic re-run of a logged decision.
- **T2.6** Trust-weighted analytics: verified vs unverified segmentation dashboard.
- **T2.7** Dry-run CRM **write proposals** rendered as receipts (never applied).
- **T2.8** RBAC with a distinct, audited approval role.

### Tier 3 — Legal-gated live later (BLOCKED; do not start) `PLANNED`
Anything that touches a real contact, real CRM, or a live channel. **Each item is
gated by a named blocker and must not begin until that blocker is cleared.**

- **T3.1** Live CRM credentials & bi-directional sync — *gated by B4.*
- **T3.2** Real contact targeting with consent basis — *gated by B2.*
- **T3.3** Channel connections (email/SMS/social), sending domains, opt-out — *gated by B5.*
- **T3.4** Production deployment infra & second tenant — *gated by B3.*
- **T3.5** The "send" / dispatch path itself — *gated by B1 + B3 + B5; remains unbuilt.*

---

## 2. Score path: 34 → 50 → 65 → 80+

Parity is scored against the Alta-class bar in the ledger. Today's honest score is
**34/100** (only `hermes/skills/` is `REAL`; everything else is `PLANNED`). Each milestone
below is a **checklist of concrete artifacts** — the score advances only when the artifacts
exist and their proof passes.

### 34 → 50 — "Governed foundation exists" (Tier 1 complete)
- [ ] T1.2 Synthetic fixtures load; real-PII validation rejects a `.com` contact. `PLANNED`
- [ ] T1.3 `budget_wheels_demo` Tenant Zero config present. `PLANNED`
- [ ] T1.4 Action ledger writes append-only entries; chain-verify passes; tamper detected. `PLANNED`
- [ ] T1.5 Claim-provenance model stores source + retrieval-time per claim. `PLANNED`
- [ ] T1.6 Dry-run engine produces a trace with **zero** channel egress. `PLANNED`
- [ ] T1.7 Proof receipt generated for one synthetic action and re-verified. `PLANNED`
- [ ] T1.8 Consent gate blocks advancing a no-consent synthetic contact. `PLANNED`
- [ ] T1.9 Approval record (approver/time/artifact) required before any advance. `PLANNED`
- [ ] T1.10 MOCK CRM read fixture available to analytics. `PLANNED`

### 50 → 65 — "Agents propose, governed end-to-end" (core of Tier 2)
- [ ] T2.1 Outbound agent produces a consent-gated, provenance-tagged draft list. `PLANNED`
- [ ] T2.2 Sequencing engine runs a multi-step dry-run with per-step ledger entries. `PLANNED`
- [ ] T2.3 Inbound agent triages synthetic inbound with a logged, reasoned decision. `PLANNED`
- [ ] T2.4 Workflow engine executes a play with per-node ledger entries. `PLANNED`
- [ ] T2.7 CRM write proposals rendered as receipts (nothing applied). `PLANNED`
- [ ] T2.8 RBAC enforces a distinct approval role in the sandbox. `PLANNED`

### 65 → 80+ — "Provable superiority demonstrated" (governance moat live in sandbox)
- [ ] T2.5 Dispute/replay pack reproduces a logged decision deterministically. `PLANNED`
- [ ] T2.6 Trust-weighted analytics show verified vs unverified split on real-ish volume. `PLANNED`
- [ ] End-to-end sandbox demo: list → draft → consent check → approval → dry-run →
      receipt → replay, all on `budget_wheels_demo` synthetic data. `PLANNED`
- [ ] Governance evidence pack: ledger export + chain proof + sample replay pack a buyer's
      auditor could inspect. `PLANNED`
- [ ] Blocker register (B1–B5) published with named owners and clear status. `PLANNED`

> **Why 80+ and not 100:** the remaining ~20 points are Tier-3, live-action capabilities
> that are *intentionally* withheld behind legal/consent blockers. Scoring above 80 would
> require live deployment we explicitly forbid in this phase. 80+ on a *governed-sandbox*
> basis is the honest ceiling for a pre-authorization build.

---

## 3. 90-day sequencing

Indicative single-track sequencing. Dates are relative to kickoff; nothing here is
committed engineering capacity.

### Weeks 1–2 — Foundation primitives
- **Build:** T1.1–T1.5 (scaffold, fixtures, Tenant Zero, action ledger, claim provenance).
- **Milestone:** Ledger writes + verifies; synthetic fixtures reject real PII.
- **Dependencies:** none. **Target score:** moving toward 50.

### Weeks 3–6 — Governed execution + first agents
- **Build:** T1.6–T1.10 (dry-run engine, receipts, consent gate, approval, MOCK CRM),
  then start T2.1–T2.4 (outbound/inbound/sequence/workflow, all dry-run).
- **Milestone (end wk 4):** 34→50 checklist complete. **Milestone (end wk 6):** first
  consent-gated, approval-required dry-run draft exists.
- **Dependencies:** Weeks 1–2 must be done; consent gate (T1.8) blocks all agent items.
- **Target score:** ~50 → mid-50s.

### Weeks 7–12 — Superiority layer + sandbox proof
- **Build:** finish T2.1–T2.4, then T2.5–T2.8 (replay pack, trust-weighted analytics,
  CRM write proposals, RBAC). Assemble the end-to-end sandbox demo + governance evidence
  pack.
- **Milestone (end wk 9):** 50→65 checklist complete. **Milestone (end wk 12):** 65→80+
  checklist complete; full proof-governed demo on `budget_wheels_demo`.
- **Dependencies:** replay pack (T2.5) needs the action ledger (T1.4) and dry-run engine
  (T1.6); trust-weighted analytics (T2.6) needs consent/approval records.
- **Target score:** 65 → **80+ (governed-sandbox basis)**.

### Beyond day 90 — Tier 3 (BLOCKED)
No Tier-3 work begins until B1–B5 are cleared by their owners. This is a deliberate stop
line, not an oversight.

---

## 4. Explicit blockers and ownership (restated)

The 80+ ceiling is *governed-sandbox*. Crossing into live GTM requires clearing these,
each owned outside the engineering backlog:

| # | Blocker | Gates | Owner (to be assigned) | Status |
|---|---------|-------|------------------------|--------|
| B1 | Legal owner / DPA & compliance sign-off | All Tier-3; consent policy; retention | Legal / Compliance lead | `PLANNED` |
| B2 | Customer consent | Targeting real contacts (T3.2) | Customer + Legal | `PLANNED` |
| B3 | Live deployment authorization | Prod infra & second tenant (T3.4) | Founder / Ops + Legal | `PLANNED` |
| B4 | CRM credentials | Live CRM sync (T3.1) | Customer admin | `PLANNED` |
| B5 | Channel approvals | Channels / sending domains / opt-out (T3.3) | Customer + vendors + Legal | `PLANNED` |

**Owner action required:** assign a named human to each of B1–B5. Until then, the program
stays in Tiers 1–2 and tops out at the honest **80+ governed-sandbox** parity. No item in
this map authorizes any live outreach, send, or CRM write.
