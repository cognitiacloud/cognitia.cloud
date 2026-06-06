-- 0001_tenants_users.sql
-- Tenancy foundation: tenants, users, roles, memberships + shared RLS helpers.
--
-- RLS: every tenant-scoped table is isolated by app.current_tenant_id().
-- `tenants` and `users` are global-ish identity; access is mediated by service
-- role and by memberships. Tenant-scoped tables in later migrations reuse the
-- helpers defined here.
-- Fixture: packages/db/fixtures/0001_tenants_users.fixture.sql

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Resolve the current tenant from a per-transaction GUC. Handlers MUST
-- `SET LOCAL app.current_tenant_id = '<uuid>'` before touching tenant data.
create or replace function app_current_tenant_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_tenant_id', true), '')::uuid
$$;

-- Trusted system jobs may set app.bypass_rls = 'on' (logged, never in request path).
create or replace function app_bypass_rls() returns boolean
language sql stable as $$
  select coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
$$;

-- Maintain updated_at on row updates.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  settings jsonb not null default '{}'::jsonb, -- e.g. { "auto_approve_low_risk": false }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table tenants is 'Root isolation boundary. settings holds approval/mode flags.';

create table users (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null unique, -- store hash, never raw email (PII rule)
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table users is 'Global identity. Raw email is never stored; email_hash only.';

create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null, -- e.g. owner, operator, viewer
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid references roles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
comment on table memberships is 'user <-> tenant <-> role. Drives tenant access.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_roles_tenant on roles (tenant_id);
create index idx_memberships_tenant on memberships (tenant_id);
create index idx_memberships_user on memberships (user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger trg_tenants_updated before update on tenants
  for each row execute function set_updated_at();
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();
create trigger trg_roles_updated before update on roles
  for each row execute function set_updated_at();
create trigger trg_memberships_updated before update on memberships
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- roles & memberships are tenant-scoped.
alter table roles enable row level security;
alter table roles force row level security;
alter table memberships enable row level security;
alter table memberships force row level security;

create policy roles_tenant_isolation on roles
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());

create policy memberships_tenant_isolation on memberships
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());

-- Note: tenants/users are managed by the service role; access to them is
-- mediated by application authz and memberships rather than per-row tenant RLS.
