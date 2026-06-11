# Cognitia — Next Build / Pilot Queue (post-v1.1)

Date: 2026-06-11. Ordered; each item is one session-sized ticket. Standing
guardrails on every ticket: no token marketing, no real SMS without the
gated path, no production deploys without founder go, evidence tags on all
claims, doctrine guard tests must stay green.

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
