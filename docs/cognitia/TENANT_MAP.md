# Cognitia GTM Control Plane — Tenant Map

Date: 2026-06-11. Framing per Architecture Lock Amendment A1: the GTM Control
Plane is Cognitia Core's first production application; every venture below is
a **tenant** of that one platform, isolated by RLS, sharing the same trust
machinery (ATC, proofs, SkillProof, reputation, credits).

Evidence note: tenant rows are seeded in the live dev DB (`verified_fact`).
Each venture's vertical description is `likely_inference` from founder
context — correct the specifics inline; the platform mapping does not change.

| Tenant           | Slug / ID                | Vertical (likely_inference)     | Agent use-case on the Control Plane                                                                                                                                                                | Measurable outcomes (the proof currency)                                                     | Onboarding order                                                      |
| ---------------- | ------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **MoverOS**      | `moveros` · `1111…`      | Moving services (Tenant Zero)   | AI Front Desk lead rescue: SMS-first response, qualify, booking intent                                                                                                                             | Response time, rescued leads, **verified booked value**                                      | **0 — live pilot now** (simulation + human send)                      |
| **Demandara**    | `demandara` · `3333…`    | Demand generation / B2B leadgen | Outbound + inbound lead qualification and follow-up agents (maps directly onto the platform's existing Mira/HubSpot GTM machinery)                                                                 | Qualified meetings booked, reply rates, pipeline value with CRM evidence refs                | 1 — closest fit: the platform's CRM/outbound substrate already exists |
| **Skillucate**   | `skillucate` · `4444…`   | Education funnel / course ops   | Enrollment front desk: inquiry response, cohort scheduling, follow-up sequences                                                                                                                    | Enrollments with payment evidence, inquiry→enroll conversion, response SLA                   | 2                                                                     |
| **AlphaInvesto** | `alphainvesto` · `5555…` | Investor research / content     | Research-intelligence agents producing evidence-tagged briefs; audience pipeline ops. **Compliance note: no investment advice, no return claims — doctrine guard discipline applies hardest here** | Subscriber/pipeline growth with receipts; content production throughput, all evidence-tagged | 3 — last, pending the compliance note                                 |

## What every tenant inherits on day one (verified_fact — built and tested)

RLS-isolated tenancy → ATC-credentialed agents (deny-by-default risky
permissions) → human approval queue → append-only evidence-tagged Proof
Registry with PII redaction → verified-fact-only reputation → internal
credits accounting → Command Dashboard with verified-only value separation.

## Onboarding mechanics (same five steps per tenant)

1. `insert into tenants` (or future provisioning endpoint) + operator role.
2. Register the tenant's agent(s) + issue ATCs scoped to its vertical.
3. Import/define the tenant's skill set (Core 20 base + vertical skills).
4. Define the tenant's outcome vocabulary + evidence sources (what counts as
   a verified receipt: CRM deal, payment ref, enrollment record).
5. Run the same loop: intake → agent proposal → approval → simulated/manual
   execution → evidence-tagged outcome → reputation.

## Cross-tenant doctrine

One platform, shared guard rails: no real sends without the owner-gated
permission path; no PII crosses tenants (RLS, live-verified); reputation and
credits are per-tenant; the token (if ever) attaches to the platform economy
across ALL tenants — never to one tenant's workflow (Lock A1).
