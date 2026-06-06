-- 0002_integrations_external_maps.sql
-- Integration connections, external<->internal object maps (idempotency
-- backbone), and sync run bookkeeping.
--
-- RLS: all three tables are tenant-scoped via app_current_tenant_id().
-- Fixture: packages/db/fixtures/tenant_isolation.fixture.sql

create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  external_system text not null,           -- hubspot | salesforce | email | ...
  status text not null default 'active',   -- active | paused | error
  -- Secret material is stored encrypted at rest and referenced by id, never raw.
  credential_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_system)
);
comment on column integration_connections.credential_ref is
  'Reference to encrypted secret; raw OAuth tokens are never stored or logged.';

-- The idempotency backbone for ingest: a given external object resolves to one
-- internal row, so duplicate webhooks never duplicate entities.
create table external_object_maps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  connection_id uuid references integration_connections(id) on delete set null,
  external_system text not null,
  external_type text not null,             -- company | contact | deal ...
  external_id text not null,
  internal_type text not null,             -- account | contact | opportunity ...
  internal_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_system, external_type, external_id)
);
comment on table external_object_maps is
  'Dedupe backbone. Unique (tenant, system, type, external_id) keeps ingest idempotent.';

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  connection_id uuid references integration_connections(id) on delete cascade,
  status text not null default 'pending', -- pending | running | completed | failed
  started_at timestamptz,
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_integration_connections_tenant on integration_connections (tenant_id);
create index idx_external_object_maps_tenant on external_object_maps (tenant_id);
create index idx_external_object_maps_internal on external_object_maps (tenant_id, internal_type, internal_id);
create index idx_sync_runs_tenant on sync_runs (tenant_id);
create index idx_sync_runs_connection on sync_runs (connection_id);

-- updated_at triggers
create trigger trg_integration_connections_updated before update on integration_connections
  for each row execute function set_updated_at();
create trigger trg_external_object_maps_updated before update on external_object_maps
  for each row execute function set_updated_at();
create trigger trg_sync_runs_updated before update on sync_runs
  for each row execute function set_updated_at();

-- RLS
alter table integration_connections enable row level security;
alter table integration_connections force row level security;
alter table external_object_maps enable row level security;
alter table external_object_maps force row level security;
alter table sync_runs enable row level security;
alter table sync_runs force row level security;

create policy integration_connections_tenant_isolation on integration_connections
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy external_object_maps_tenant_isolation on external_object_maps
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy sync_runs_tenant_isolation on sync_runs
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
