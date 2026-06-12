# Next Prompts for Agent Sessions

Short execution prompts, in order. Standing rules: read
`V1_1_FINAL_HANDOFF.md` + `ARCHITECTURE_LOCK_V1_1.md` (incl. A1) first;
evidence tags on claims; no token marketing, real SMS, real payments, or
production deploys; doctrine guards must stay green; branch from `main`.

## Prompt: COG-013 — Twilio SANDBOX integration

Goal: sandbox-only SMS provider behind the EXISTING gates (approval +
owner-gated `sms.send_real` + simulation flag). Inspect: frontdesk.ts
executeSimulatedSend, agent_permissions, RealSendRefusedError. Acceptance:
sandbox send only when simulation:false AND permission allow AND approval —
all three; missing any → refused (tested); no real customer numbers; no
credentials committed. Do NOT touch CASL-gated real traffic.

## Prompt: COG-014 — Demandara tenant onboarding pilot

Goal: exercise provisionTenant('demandara') end-to-end on dev DB; define its
outcome evidence sources (CRM refs); adapt front-desk loop or Mira outbound
machinery to one Demandara lead flow; record first evidence-tagged outcomes.
Acceptance: Demandara mission-loop test mirroring missionLoop.e2e for the
demand-gen vertical; zero cross-tenant leakage assertions.

## Prompt: COG-015 — moveros-staging HTTP integration spike

Goal: webhook intake (their leads → our lead_intakes) + evidence_source refs
back (their job/invoice ids). Constraint: HTTP only — NEVER shared DB
(schema collision documented in LANE_A_DEV_DB_VERIFICATION.md). Acceptance:
signed-webhook intake route (reuse HubSpot webhook HMAC pattern), mapping
doc, tests.
