# COG-014 — Demandara Onboarding Loop (first pass)

Date: 2026-06-12. Evidence: `verified_fact` unless noted.

## What was proven (demandaraLoop.e2e.test.ts, green first run)

The SAME GTM Control Plane machinery that runs MoverOS (Tenant Zero) runs a
second vertical with zero new trust logic:

1. `POST /tenants {slug: demandara}` provisions the tenant: pipeline agent
   with ATC scopes `lead.read/crm.read/email.draft`, sms.send_real deny
   seeded, Core 20 imported — all inside Demandara's RLS scope.
2. Inbound B2B prospect (web, consented) → qualify + outreach proposal →
   human approval (`high_value_target`) → simulated send with response time.
3. `booking_intent` outcome with a CRM evidence ref
   (`crm:hubspot:deal:dmd-001`) → verified_fact → reputation credited to the
   Demandara agent.
4. Demandara's command dashboard shows only its world; **hard isolation**
   verified both directions against a co-provisioned Tenant Zero (zero
   leads/reputation crossover; cross-seat lead detail 404; zero PII in
   aggregates).
5. Identical guardrails on tenant two: real send → 403.

## Honest finding

The AI draft template is MoverOS-flavored ("Thanks for reaching out about
your move…") — mechanically fine for the demand-gen flow but wrong copy.
**Follow-up: vertical-aware draft templates keyed off the tenant's spec
vertical** (small ticket; template selection in frontdesk.ts draftReply).

## Remaining COG-014 scope (founder-gated)

Run this loop against the persistent dev DB once provided, and with a real
Demandara prospect list (`unknown` until the founder supplies one).
