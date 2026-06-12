# COG-014 — Demandara Onboarding Loop

Date: 2026-06-12. Evidence: `verified_fact` unless noted.

## What was proven (demandaraLoop.e2e.test.ts, green)

The SAME GTM Control Plane machinery that runs MoverOS (Tenant Zero) runs a
second vertical with zero new trust logic, through the full directive
workflow **research → draft outreach → QA → approval-required → proof →
outcome**:

1. **Provision** — `POST /tenants {slug: demandara}`: pipeline agent with
   ATC scopes `lead.read/crm.read/email.draft`, sms.send_real deny seeded,
   Core 20 imported — all inside Demandara's RLS scope.
2. **Intake** — inbound B2B prospect (web, consented), PII encrypted at
   rest as on Tenant Zero.
3. **Research stage** — `qualify_lead` + `estimate_urgency` proposals; each
   returns a `proof_id` (every action creates or links proof).
4. **Draft outreach → QA stage** — the draft first FAILS human QA: rejected
   with a structured reason (`tone_off_brand`), after which execution is
   refused (409 — QA-rejected drafts cannot send). Re-proposing identical
   content is **idempotent** (content fingerprint → the same action, so no
   duplicate outreach can be minted to dodge a rejection); passing QA is
   therefore an explicit human reconsideration — approval with
   `high_value_target`. Both decisions persist as feedback labels
   (`rejected` AND `approved` on the same action), so the QA trail is
   auditable.
5. **Approval-required execution** — only the approved action executes a
   simulated send with measured response time.
6. **Proof discipline** — asserted across the whole loop: all 3 actions are
   proof-linked and every proof carries an evidence tag.
7. **Outcome** — two outcomes recorded:
   - `booking_intent` tagged `likely_inference` (no evidence ref) → moves
     **zero** reputation;
   - `booking_intent` tagged `verified_fact` with a CRM evidence ref
     (`crm:hubspot:deal:dmd-001`) → reputation credited to the Demandara
     agent. Only verified_fact moves reputation — proven on tenant two.
8. **Isolation + guardrails** — Demandara's dashboard shows only its world
   (both outcomes counted, one reputation event); hard isolation verified
   both directions against a co-provisioned Tenant Zero (zero
   leads/reputation crossover; cross-seat lead detail 404; zero PII in
   aggregates); real send → 403 on tenant two, same as Tenant Zero.

## Honest findings

- The AI draft template is MoverOS-flavored ("Thanks for reaching out about
  your move…") — mechanically fine for the demand-gen flow but wrong copy.
  **Follow-up: vertical-aware draft templates keyed off the tenant's spec
  vertical** (small ticket; template selection in frontdesk.ts draftReply).
- Draft idempotency is by content fingerprint, so a deterministic template
  means a rejected draft re-proposed is the SAME action. That is the right
  safety property (no duplicate outreach), but once templates vary, a
  revised draft will be a NEW action and the reject→revise→approve path
  will produce two actions instead of one reconsidered one. The test
  documents the current behavior honestly.

## Remaining COG-014 scope (founder-gated)

Run this loop against the persistent dev DB once provided, and with a real
Demandara prospect list (`unknown` until the founder supplies one). All
outreach remains simulated until CASL review and the owner-gated real-send
path are explicitly enabled.
