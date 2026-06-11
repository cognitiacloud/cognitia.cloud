# Lane A — Dev DB Verification

> Framing (Architecture Lock A1): MoverOS is **Tenant Zero** — the first
> vertical proof environment for the Cognitia GTM Control Plane, the first
> production application of Cognitia Core. Moving is the proving ground
> (measurable lead + booking outcomes), not the company focus.

Date: 2026-06-11. Evidence: `verified_fact` unless noted.

## ✅ EXECUTED 2026-06-11 — migrations applied + live verification on a real dev Postgres

A safe dev database was stood up **locally in the session container**
(PostgreSQL 16.13 + pgvector, fresh cluster, zero shared infrastructure) and
the full pipeline executed (`verified_fact`):

| Step                                                       | Result                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations 0001–0014 via `apply-migrations.mjs`            | **all 14 applied cleanly, in order**                                                                                                                                                                                                |
| RLS under NON-superuser role (`cognitia_app`, NOBYPASSRLS) | **enforced**: tenant A sees only A's rows, B only B's, and **no tenant GUC → zero rows** (default-deny) — the one check PGlite could not cover                                                                                      |
| API booted with `DATABASE_URL` as `cognitia_app`           | health `db:up`; full HTTP loop: agent+ATC → Core 20 import → encrypted lead → approval → real-send refused **403** → simulated send (93 ms) → verified $1,750 receipt → reputation snapshot (score 5) → credits + wallet            |
| Command Dashboard on live DB                               | populated; **verified_booked_value_cents = 175000**; zero PII; gates closed                                                                                                                                                         |
| Integration bug found by this run                          | `pg` returns bigint as strings → `getLeadRescueSummary` value sums concatenated instead of adding. **Fixed** (`Number()` coercion in `frontdesk.ts`) and re-verified live. The in-memory and PGlite paths could not have caught it. |
| `pg` driver                                                | added as workspace dep (`pnpm add -w pg`) — the step the apply script itself documents                                                                                                                                              |

The local cluster is ephemeral with the container. For a PERSISTENT dev DB,
the Supabase options below still stand (founder-gated).

## Supabase account state (inspected; unchanged)

`DATABASE_URL` was not pre-set in this environment. The founder's Supabase
account (connected via MCP) was inspected:

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
