# TrustOps Analytics

Analytics for Cognitia that aim to **surpass Alta-class revenue
intelligence by pairing every revenue signal with trust and proof**.
Where a typical revenue dashboard tells you _how much_ an AI agent
produced, TrustOps also tells you _whether it was safe, compliant, and
provable_ — and refuses to celebrate revenue that was earned by cutting
those corners.

This document defines the metric catalog, the first concrete deliverable
(Client Zero dashboard v1), the later Luna-equivalent roadmap, and the
metrics that stay blocked until a real client has consented.

## Why trust + proof beats revenue-only

Alta-class analytics optimize a single question: _did the agent move the
revenue number?_ That framing is dangerous for an autonomous agent. An
agent can inflate conversion by making unsafe claims, skipping approvals,
overriding policy, or quietly mishandling regulated data. A revenue-only
dashboard rewards exactly that behavior because it never sees the
liability being created underneath the number.

TrustOps makes two things first-class, measurable dimensions alongside
revenue:

- **Trust** — a continuously scored judgment of how safely an agent is
  operating: how often it is blocked, how often it tries to override
  policy, how often it makes claims it cannot support.
- **Proof** — a verifiable evidence trail behind each outcome. "Proof"
  here means a durable, auditable record: the logged decision, the policy
  checks that ran, the approval that was granted, and the artifacts that
  back a claim. An outcome with no proof is treated as unverified, not as
  success.

The headline metric (`conversion weighted by trust`) is deliberately
constructed so that revenue earned by an untrustworthy or unprovable path
is discounted. You cannot make the top-line number go up by behaving
worse.

## Metric catalog

Ten metrics make up v1. Each entry gives a definition, how it is computed
(intent only — no implementation here), its unit and window, and the
**trust/proof angle**: what it surfaces that a revenue-only view misses.

All metrics are computed per agent and per tenant, and roll up to a
tenant-wide view.

### Revenue & responsiveness (Alta parity, hardened)

These mirror what a revenue-intelligence product already reports, but
every one is tied back to a proof trail so the number can be audited.

#### Lead response time

- **Definition** — elapsed time from a new lead arriving to the agent's
  first substantive response.
- **Computation** — `first_response_at − lead_received_at`, reported as
  median and 90th percentile over the window.
- **Unit / window** — seconds or minutes; rolling 7-day and 30-day.
- **Trust/proof angle** — each measured response links to the logged
  outbound message, so "we responded in 45s" is provable, not asserted.

#### After-hours capture

- **Definition** — share of leads arriving outside business hours that
  still received a timely, compliant response.
- **Computation** — `after_hours_leads_responded / after_hours_leads`,
  where "responded" requires the response to have passed policy checks.
- **Unit / window** — percentage; rolling 30-day, segmented by hour.
- **Trust/proof angle** — captures the core "the agent never sleeps"
  value, but only counts responses that were _compliant_, so off-hours
  coverage can't be inflated with unreviewed messages.

#### Appointment created

- **Definition** — count of confirmed appointments/bookings the agent
  produced.
- **Computation** — count of booking events with a confirmed status and a
  linked calendar/CRM artifact.
- **Unit / window** — count and per-lead rate; rolling 7-day and 30-day.
- **Trust/proof angle** — each appointment must reference a real
  confirmation artifact (calendar event, CRM record). Appointments
  without backing proof are flagged as unverified and excluded from the
  headline rate.

#### Conversion weighted by trust

- **Definition** — the headline outcome metric: conversions discounted by
  the trust score of the path that produced them. See
  [Composite: conversion weighted by trust](#composite-conversion-weighted-by-trust)
  for the full treatment.
- **Computation** — sum of conversions each multiplied by the contributing
  agent's trust score (0–1) at the time of conversion.
- **Unit / window** — trust-adjusted conversions and a trust-adjusted
  conversion rate; rolling 30-day.
- **Trust/proof angle** — this is the metric that cannot be gamed by
  unsafe behavior. Raw conversion is still shown beside it so the gap
  between "earned" and "trustworthy" is visible.

### Trust & safety (the differentiator)

These have no equivalent in a revenue-only product. They are the proof
that the revenue above was earned safely.

#### Approval latency

- **Definition** — time an action waits for required human or policy
  approval before it can proceed.
- **Computation** — `approved_at − approval_requested_at`, median and
  90th percentile.
- **Unit / window** — seconds or minutes; rolling 7-day.
- **Trust/proof angle** — proves the approval gate is real and being
  honored. Low latency shows approvals aren't a bottleneck; the existence
  of the measurement proves actions actually stop and wait.

#### Compliance block rate

- **Definition** — share of attempted actions stopped by a compliance or
  policy control.
- **Computation** — `blocked_actions / attempted_actions`, segmented by
  the rule that triggered the block.
- **Unit / window** — percentage; rolling 7-day and 30-day.
- **Trust/proof angle** — a healthy non-zero rate proves the guardrails
  are active. A sudden drop to zero is itself a warning (controls may be
  disabled), not a cause for celebration.

#### Proof completeness

- **Definition** — share of revenue-relevant outcomes that carry a
  complete, verifiable evidence trail.
- **Computation** — `outcomes_with_complete_proof / total_outcomes`,
  where "complete" means the decision log, policy-check result, and
  supporting artifact are all present and linked.
- **Unit / window** — percentage; rolling 30-day.
- **Trust/proof angle** — this is the single best measure of whether the
  whole dashboard can be trusted. The closer to 100%, the more every
  other number is independently auditable.

#### Policy override attempts

- **Definition** — count of attempts to bypass, disable, or override a
  policy control — whether by the agent or a human operator.
- **Computation** — count of override-attempt events, split by outcome
  (denied / granted-with-approval) and by initiator.
- **Unit / window** — count; rolling 7-day, with per-event detail.
- **Trust/proof angle** — directly measures pressure on the guardrails.
  Each attempt is logged as proof, so overrides are never silent.

#### Unsafe claim attempts

- **Definition** — count of times an agent tried to state something it
  could not substantiate (e.g., a guarantee, a price, or a fact with no
  backing artifact) and was caught by claim-verification.
- **Computation** — count of generated statements flagged by the
  claim-verification layer as unsupported, before they reached a lead.
- **Unit / window** — count and per-message rate; rolling 7-day.
- **Trust/proof angle** — quantifies hallucination/over-promising risk at
  the point of customer contact. A revenue dashboard would never see
  these because the unsafe claims were blocked before converting.

#### Agent trust score trend

- **Definition** — the direction and trajectory of each agent's trust
  score over time.
- **Computation** — trust score (0–1) is a composite of the safety
  metrics above (block rate health, override attempts, unsafe claim
  attempts, proof completeness, approval adherence); the trend is its
  change across the window.
- **Unit / window** — score 0–1 plus slope; rolling 30-day and 90-day.
- **Trust/proof angle** — turns one-off safety events into a trajectory,
  so a slowly degrading agent is caught before it produces an incident.
  This score is the multiplier used by conversion weighted by trust.

## Composite: conversion weighted by trust

The headline number is intentionally not raw conversion. Each conversion
is multiplied by the trust score of the agent (and path) that produced it
at the moment it converted:

- An agent operating cleanly (trust ≈ 1.0) gets near-full credit.
- An agent racking up override attempts, unsafe claims, missing proof, or
  a falling trust trend has its conversions discounted.

Two consequences make this the anchor of the whole system:

- **It cannot be gamed by behaving worse.** Cutting safety corners to
  close more deals lowers the trust multiplier, so the trust-weighted
  number can fall even as raw conversion rises.
- **The gap is the insight.** Showing raw conversion next to
  trust-weighted conversion makes "revenue we earned" versus "revenue we
  can stand behind" visible at a glance. A widening gap is an early
  warning that revenue is outrunning trust.

## Client Zero dashboard v1

**Client Zero** is our own first tenant — an internal/design-partner
deployment running on synthetic or self-owned data only (see
[Blocked until real client consent](#blocked-until-real-client-consent)).
It exists to prove the analytics end-to-end before any real customer data
is involved.

Dashboard v1 is a single tenant-scoped view with these tiles, mapped to
the catalog above:

- **Headline** — conversion weighted by trust, shown beside raw
  conversion, with the gap called out.
- **Responsiveness** — lead response time (median / p90) and after-hours
  capture.
- **Output** — appointments created (count and per-lead rate).
- **Trust panel** — agent trust score trend (sparkline per agent),
  compliance block rate, approval latency.
- **Safety events** — policy override attempts and unsafe claim attempts,
  each drillable to the logged proof for the event.
- **Proof** — proof completeness as a top-level health gauge for the
  whole dashboard.

Operational characteristics for v1:

- **Data source** — Client Zero's own event logs (decisions, policy
  checks, approvals, artifacts) on synthetic/self-owned data only.
- **Refresh cadence** — near-real-time for safety events; daily rollups
  for the rolling-window revenue metrics.
- **Scope** — single tenant, single dashboard, drill-down to per-event
  proof.

Explicitly **out of scope for v1**:

- Cross-client benchmarking or cohort comparison.
- Any real prospect/PII-level data.
- Proactive narratives or alerting (those are the Luna-equivalent layer).

## Luna-equivalent roadmap (later)

_This section is forward-looking. None of it ships in v1._

The "Luna-equivalent" layer is an ambient, assistant-style analytics
experience that turns the metric catalog from a dashboard you read into
insight that comes to you. Planned phases:

- **Phase 1 — Dashboard (now)** — Client Zero dashboard v1, as above.
- **Phase 2 — Alerting (next)** — anomaly detection on the trust and
  safety metrics: notify on a falling trust trend, a spike in override or
  unsafe-claim attempts, a collapse in compliance block rate, or a drop
  in proof completeness. Still single-tenant.
- **Phase 3 — Luna-equivalent insight layer (later)** — proactive natural
  language narratives ("trust dipped on Agent A because override attempts
  tripled on Tuesday"), benchmarked cohort comparisons across many
  consenting clients, and recommended actions. This phase is gated on
  real, consented, multi-tenant data and on the consent rules below.

## Blocked until real client consent

The following capabilities and metrics are **blocked** until a real
client has given written consent (and a data processing agreement, DPA,
is in place). Until then they run on synthetic or Client-Zero-owned data
only, or not at all:

- **Cross-client benchmarking / cohort comparison** — any metric that
  compares one client's agents against another's.
- **Per-person / PII-level lead data** — any view that exposes real
  individual prospects, their contact details, or their messages.
- **Real-prospect conversion attribution** — tying conversion or
  trust-weighted conversion to identifiable real customers.
- **Luna-style narratives over real customer content** — any proactive
  summary or alert that surfaces a real customer's data or conversations.

**Gating rule:** no real-client data enters TrustOps analytics until
there is (1) explicit written client consent and (2) an executed DPA.
Everything demonstrable before that point must run on synthetic or
self-owned (Client Zero) data. This rule supersedes any roadmap item
above.

## Open questions / next steps

- Confirm the exact 0–1 weighting formula for the agent trust score
  composite and which safety metrics dominate it.
- Decide the threshold at which a falling trust trend triggers a Phase 2
  alert.
- Define the canonical "complete proof" checklist used by proof
  completeness.
- Ship Client Zero dashboard v1 on synthetic data, then revisit a docs
  index once more architecture docs exist.
