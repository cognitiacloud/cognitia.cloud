# Alpha Rollout Record — live execution log (fill as you go)

> The operator's working document for the first live rollout AND the SOC 2 evidence
> artifact. One row per step: check the box, paste evidence links, note deviations.
> Steps reference `operator-handoff.md` / `deploy-verification.md`. Deployed commit: \_\_\_\_

| #   | Step                                                                                                            | Pass criteria                                                                                   | Evidence captured (link)                                      | Rollback trigger                                                                                    | ✅  |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --- |
| 1   | Provision DB (migrations 0001–**0008**, `app_user`, backups+PITR)                                               | migrations apply cleanly; `select current_user` = app_user; PITR on                             | role grant export; backup config screenshot                   | migration error → stop, do not proceed                                                              | ☐   |
| 2   | Set env (4 secrets)                                                                                             | all 4 set from secret manager; none committed/logged                                            | secret-manager refs (names only)                              | any secret in shell history/logs → rotate per `secret-rotation.md`                                  | ☐   |
| 3   | Deploy + `deploy-verification.md` checks 1–7                                                                    | all pass (health 200/db-up; 401/403 fail-closed; fence 404; isolation)                          | deploy id+commit; curl outputs                                | any of checks 1–7 fails → fix before customer data                                                  | ☐   |
| 4   | HubSpot portal: private app (least-priv) + `cognitia_idempotency_key` on Tasks AND Notes                        | property visible on both objects; scopes exactly per handoff                                    | scopes screenshot; property screenshot                        | wrong scopes → recreate app before seeding                                                          | ☐   |
| 5–6 | Seed tenant + credential: `node apps/api/scripts/seed-hubspot-credential.mjs --tenant <uuid>` (secrets via env) | script prints `{ok:true,...}`; `integration_connections` row active                             | script output JSON (refs only)                                | script error → fix env/DB, re-run (idempotent upsert)                                               | ☐   |
| 7   | Issue session: `node apps/api/scripts/issue-session.mjs --tenant <uuid> --role operator`                        | token verifies (console sign-in works)                                                          | n/a (do NOT store the token as evidence)                      | 401 in console → re-issue; check SESSION_SECRET parity                                              | ☐   |
| 8   | Read sync                                                                                                       | accounts/contacts/deals visible; `sync_runs` completed; no `client_unconfigured` log            | sync_runs row; log excerpt (no tokens)                        | HubSpot 401 → token/scopes wrong: pause + reseed                                                    | ☐   |
| 9   | First live action: console → Run Mira → execute-before-approve (expect 409) → Approve → Execute                 | 409 surfaced pre-approval; after approval exactly ONE HubSpot task, tagged with idempotency key | screen recording; HubSpot task screenshot; audit chain export | duplicate/wrong object → **kill switch** (`status='paused'`), delete object, verify property exists | ☐   |
| 10  | Idempotency re-run: Execute again                                                                               | no second task in HubSpot                                                                       | HubSpot list screenshot (count=1)                             | second task appears → kill switch + treat as R-6; check property                                    | ☐   |
| 11  | Kill switch drill: set `status='paused'`, attempt execute                                                       | execution refused/no write                                                                      | SQL + refused output                                          | n/a (this IS the drill)                                                                             | ☐   |
| 12  | Log hygiene: grep deployed logs for the HubSpot token + a known raw email                                       | zero hits                                                                                       | grep command + empty result                                   | any hit → SEV-1 per `incident-response.md`, rotate                                                  | ☐   |

## Go / No-Go — "ready to invite design partner"

**GO requires:** rows 1–12 all ✅ **and** `design-partner-alpha-checklist.md` safety/comms
items done (IR contact path; DPA; scope note: "CRM tasks/notes only, no emails").
**NO-GO if any of:** check 1–7 deploy failures; duplicate task in row 10; token/PII in
logs (row 12); kill switch ineffective (row 11).

Decision: ☐ GO ☐ NO-GO · Date: \_**\_ · Signed (operator): \_\_** · Signed (eng): \_\_\_\_

## Notes / deviations

- \_
