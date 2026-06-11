# Lane A — Dev DB Verification

> Framing (Architecture Lock A1): MoverOS is **Tenant Zero** — the first
> vertical proof environment for the Cognitia GTM Control Plane, the first
> production application of Cognitia Core. Moving is the proving ground
> (measurable lead + booking outcomes), not the company focus.

Date: 2026-06-11. Evidence: `verified_fact` unless noted.

## Result: NO safe Cognitia dev DB is currently available — nothing applied.

`DATABASE_URL` is not set in this environment. The founder's Supabase account
(connected via MCP) was inspected:

| Project                                                          | Status                | Safe for Cognitia migrations?                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ferozmoverscanada@gmail.com's Project` (`ftudmaqlxvloopdhpjlp`) | ACTIVE                | **Not touched** — personal/business project, treated as production-adjacent                                                                                                                                                                                                                                                                                         |
| `Cognitia Preview` (`gvalrnavqdpiztbxrdsj`)                      | **INACTIVE (paused)** | Likely the intended Cognitia DB (`likely_inference` from its name) — restore requires founder approval (this session's attempt was permission-denied, correctly)                                                                                                                                                                                                    |
| `moveros-staging` (`eafmynuuuhtfhcyoazam`)                       | ACTIVE                | **NO — do not apply Cognitia migrations here.** It hosts a complete, separate MoverOS operations app (~75 tables incl. jobs, customers, quotes, Stripe billing, Twilio voice) with live-looking staging data, and its `public.leads` table **collides by name** with Cognitia migration 0003's `leads`. Applying 0001–0014 would fail or corrupt that app's schema. |

## Exact setup needed (founder, ~10 minutes)

1. **Unpause `Cognitia Preview`** in the Supabase dashboard (or say the word
   and a session can restore it via MCP with your approval), OR create a
   fresh project named e.g. `cognitia-dev`.
2. Confirm the project is empty / not production (list tables — should be
   zero Cognitia-conflicting tables).
3. Get the Postgres connection string (Dashboard → Connect → URI; includes
   the DB password, which MCP deliberately cannot read).
4. In the dev shell: `export DATABASE_URL='postgres://…'` and `pnpm add -w pg`,
   then `node packages/db/scripts/apply-migrations.mjs` → applies 0001–0014
   in order, one transaction each.
5. Set `SESSION_SECRET`, `COGNITIA_PII_KEY_BASE64` (32-byte base64),
   `CREDENTIAL_SECRET_KEY_BASE64`.
6. Re-run the smoke in `POST_MERGE_VERIFICATION.md` against the live DB.

## RLS check to run once the DB exists (the one thing PGlite cannot verify)

```sql
-- as the postgres/admin user:
create role app_user login password '<dev-only>';
grant usage on schema public to app_user;
grant select, insert, update on all tables in schema public to app_user;
-- then connect AS app_user and verify:
begin;
set local app.current_tenant_id = '<tenant-A-uuid>';
select count(*) from lead_intakes;  -- only tenant A rows
set local app.current_tenant_id = '<tenant-B-uuid>';
select count(*) from lead_intakes;  -- only tenant B rows; A's invisible
rollback;
```

Everything else (constraints, triggers, append-only guards, tenant filters)
is already verified against real Postgres semantics via PGlite (400/400).
