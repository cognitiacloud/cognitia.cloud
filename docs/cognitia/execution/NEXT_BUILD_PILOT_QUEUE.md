# Cognitia — Next Build / Pilot Queue (post-v1.1)

Date: 2026-06-11; amended 2026-06-12. Ordered; each item is one session-sized
ticket. Standing guardrails on every ticket: no token marketing, no real SMS
without the gated path, no production deploys without founder go, evidence
tags on all claims, doctrine guard tests must stay green.

> **Mission correction (founder, 2026-06-12):** Cognitia is the agent trust,
> execution, economy, and future crypto platform. GTM and MoverOS are proof
> environments, not the destination. The GTM track below continues as pilot
> work; the ECONOMY track is the main line. COG-016 (field provenance) is
> deferred — parked on `claude/cog-016-field-provenance`, no PR.

## Economy track (main line)

| #   | Ticket                                                                | Status / gate                                                                                                                                                              |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-1 | ~~AGENT-ECONOMY-001 — Agent Economy Lab~~ **DONE**                    | work orders + escrow simulation + proof-backed completion + reputation + `/agent-economy` console + private token docs (`docs/cognitia/crypto/`)                           |
| E-2 | ~~AGENT-ECONOMY-002 — dispute resolution~~ **DONE**                   | owner arbitration (release/refund/split) over held escrow; append-only record + verified_fact resolution proof (0017)                                                      |
| E-3 | ~~AGENT-ECONOMY-003 — agent-driven accept/deliver~~ **DONE**          | ledger asks (ATC + permission gated, approval-required) + operator execute through the safe path; verify/resolve stay human                                                |
| E-4 | ~~AGENT-ECONOMY-004 — marketplace listings + matching~~ **DONE**      | internal-only listings (0018) + evidence-backed tier-aware ranking; ordering files the worker's ledger ask                                                                 |
| E-5 | ~~AGENT-ECONOMY-005 — cross-tenant settlement design~~ **DONE (doc)** | CROSS_TENANT_SETTLEMENT_DESIGN.md: two-ledger clearing model, attestation-based reputation portability, stage ladder; implementation = future 0019+ tickets, founder-gated |

## Crypto track (everything legal-gated; internal docs only)

| #   | Ticket                                                              | Status / gate                                                                      |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| T-1 | ~~TOKEN-LAB-002 — internal token architecture spec~~ **DONE (doc)** | `crypto/TOKEN_LAB_002_ARCHITECTURE_INTERNAL.md`; all TOKEN_GATES remain NOT PASSED |
| T-2 | TOKEN-LAB-003 — S0 local sandbox spike (throwaway)                  | founder go; local chain only; no toolchain lands in repo without it                |
| T-3 | Counsel engagement pack                                             | founder; uses the §5 checklist in the 002 spec                                     |

## Now (unblocks Tenant Zero Week 1)

| #   | Ticket                                           | Type              | Notes                                                                                                                                            |
| --- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Persistent dev DB                                | founder + session | Unpause `Cognitia Preview` / provide DATABASE_URL; re-run the documented apply + RLS + smoke (proven procedure in LANE_A_DEV_DB_VERIFICATION.md) |
| 2   | Default branch → `main`                          | founder click     | Settings → General → Default branch                                                                                                              |
| 3   | Recruit Tenant Zero mover                        | founder           | TENANT_ZERO_PILOT_EXECUTION.md Week 0                                                                                                            |
| 4   | Lead-detail console page                         | build (COG-011)   | API exists (`GET /leads/:id`, operator-only decryption); operator ergonomics for Week 1+ volume                                                  |
| 5   | Tenant provisioning endpoint + console (COG-012) | build             | `POST /tenants` (owner-only) wrapping the 5-step onboarding in TENANT_MAP.md; turns tenant rows into one click — needed before Demandara         |

## Next (during/after pilot Weeks 2–4)

| #   | Ticket                                           | Type          | Notes                                                                                                                                    |
| --- | ------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | CASL consent review                              | counsel       | Blocks any real customer messaging                                                                                                       |
| 7   | Twilio SANDBOX integration (COG-013)             | build         | Behind existing approval + owner-gated `sms.send_real`; sandbox numbers only                                                             |
| 8   | Demandara tenant onboarding (COG-014)            | build + pilot | Closest platform fit (existing CRM/outbound substrate); define outcome vocabulary + evidence sources                                     |
| 9   | moveros-staging HTTP integration spike (COG-015) | build         | The discovered MoverOS ops app → webhook leads in, job/invoice IDs back as `evidence_source`. **Never shared DB** (collision documented) |
| 10  | Pilot report + proof pack v2                     | docs          | Week 4 deliverable: the verified vertical track record, evidence-tagged                                                                  |

## Later (gated)

| #   | Ticket                           | Gate                                                                          |
| --- | -------------------------------- | ----------------------------------------------------------------------------- |
| 11  | Skillucate tenant onboarding     | After Demandara pattern proves repeatable                                     |
| 12  | AlphaInvesto tenant onboarding   | After compliance note in TENANT_MAP.md is addressed (no advice/return claims) |
| 13  | Stripe sandbox billing spike     | After a paying pilot exists; widens the rail check deliberately               |
| 14  | External narrative website       | Product story only; doctrine guards enforce zero token marketing              |
| 15  | USDC/Base sandbox RESEARCH spike | Internal doc only; legal gate intact (Lock §5 + A1 token framing)             |

## Sequencing logic

Everything funnels through one proof: Tenant Zero's verified booked value.
Items 1–5 make Week 1 real; 6–10 convert the pilot into the repeatable
tenant-onboarding machine; 11–15 scale it — each behind its own gate.

## Visibility / diligence-readiness track

| #    | Item                                        | Status                                          |
| ---- | ------------------------------------------- | ----------------------------------------------- |
| V-1  | Public-safe diligence overview              | DONE (CRYPTO-VISIBILITY-001)                    |
| V-4  | Public-safe Trust/Proof Explorer (`/trust`) | DONE — read-only page + guards; static snapshot |
| V-2  | Public team page                            | founder identity sign-off                       |
| V-4b | Live redaction-gated public proof feed      | founder go                                      |
| V-5  | External security audit                     | founder budget                                  |
| V-6  | Managed-Postgres RLS verification           | dev DATABASE_URL (founder)                      |
