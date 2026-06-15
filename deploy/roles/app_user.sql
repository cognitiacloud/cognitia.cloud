-- deploy/roles/app_user.sql
--
-- Canonical least-privilege application role. The API + worker connection pools
-- MUST connect as THIS role, never as a superuser/service_role — RLS is
-- bypassed for superusers and BYPASSRLS roles, and the API refuses to boot in
-- production under any RLS-bypassing role (packages/db/src/rlsGuard.ts).
--
-- Run ONCE per database, as a superuser, AFTER migrations are applied (reserve
-- the superuser for migrations only). Idempotent — safe to re-run. The operator
-- sets the role password out of band (e.g. `alter role app_user password ...`
-- from the secret manager), never in source.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user with login nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end$$;

-- Belt-and-braces: ensure the attributes even if the role pre-existed.
alter role app_user nosuperuser nobypassrls nocreatedb nocreaterole;

-- Schema + DML on existing objects.
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;

-- Future objects created by later migrations inherit the same grants, so a new
-- table does not silently become inaccessible (or over-permissive).
alter default privileges in schema public
  grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public
  grant usage, select on sequences to app_user;
alter default privileges in schema public
  grant execute on functions to app_user;

-- Defense in depth for the append-only tables: remove UPDATE/DELETE at the
-- GRANT level too, on top of their RLS policies (which already forbid it). A
-- future policy mistake therefore still cannot let application traffic rewrite
-- or truncate the event stream or the audit chain.
revoke update, delete on events from app_user;
revoke update, delete on audit_events from app_user;
