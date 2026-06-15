-- 0004_events_agent_runs_actions.sql
-- The agent core: immutable events, agent runs, agent actions (audit unit),
-- recommendations, and the audit trail.
--
-- RLS: tenant-scoped. events & audit_events are append-only (insert+select);
-- agent_actions allow status/result updates via the ledger but never delete.
-- Fixture: packages/db/fixtures/tenant_isolation.fixture.sql

-- Immutable event log. event_name follows domain.entity.action.vN.
create table events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  event_name text not null,
  entity_type text not null,
  entity_id uuid not null,
  source text not null,           -- api | worker | agent:mira | hubspot ...
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb, -- refs/hashes only, no raw PII
  trace_id text not null,
  created_at timestamptz not null default now()
);
comment on table events is 'Immutable event log. Insert-only; corrections are new events.';

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent text not null,            -- mira | echo | atlas | beacon
  objective text not null,
  input_refs jsonb not null default '[]'::jsonb,
  status text not null default 'pending', -- pending | running | completed | failed
  trace_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The audit unit. Every external side effect is preceded by one of these.
create table agent_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_run_id uuid not null references agent_runs(id) on delete cascade,
  action_type text not null,      -- email.draft.send | crm.task.create | crm.note.create
  risk_level text not null,       -- none | low | medium | high
  idempotency_key text not null,
  approval_status text not null default 'proposed', -- proposed | approved | rejected
  execution_status text not null default 'pending', -- pending | executing | executed | failed
  target_ref text not null,       -- contact:uuid | account:uuid
  evidence_refs jsonb not null default '[]'::jsonb,
  payload_ref text,               -- pointer to draft content; no inline PII
  guardrail_results jsonb not null default '[]'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotency: a given semantic action executes at most once per tenant.
  unique (tenant_id, idempotency_key)
);
comment on table agent_actions is
  'Side-effect audit unit. Required fields: idempotency_key, approval_status, execution_status.';

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_run_id uuid references agent_runs(id) on delete set null,
  kind text not null,             -- score | next_step | persona_pick ...
  entity_ref text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_ref text not null,        -- user:uuid | agent:mira | system
  action text not null,           -- proposed | approved | rejected | executed | failed
  subject_ref text not null,      -- agent_action:uuid ...
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table audit_events is 'Append-only human/system audit trail.';

-- Indexes
create index idx_events_tenant_entity on events (tenant_id, entity_type, entity_id, occurred_at);
create index idx_events_tenant_name on events (tenant_id, event_name, occurred_at);
create index idx_events_trace on events (trace_id);
create index idx_agent_runs_tenant on agent_runs (tenant_id, status);
create index idx_agent_actions_tenant_status on agent_actions (tenant_id, approval_status, execution_status);
create index idx_agent_actions_run on agent_actions (tenant_id, agent_run_id);
create index idx_recommendations_tenant on recommendations (tenant_id);
create index idx_audit_events_tenant on audit_events (tenant_id, occurred_at);
create index idx_audit_events_subject on audit_events (tenant_id, subject_ref);

-- updated_at triggers (mutable tables only)
create trigger trg_agent_runs_updated before update on agent_runs for each row execute function set_updated_at();
create trigger trg_agent_actions_updated before update on agent_actions for each row execute function set_updated_at();
create trigger trg_recommendations_updated before update on recommendations for each row execute function set_updated_at();

-- RLS
alter table events enable row level security;
alter table events force row level security;
alter table agent_runs enable row level security;
alter table agent_runs force row level security;
alter table agent_actions enable row level security;
alter table agent_actions force row level security;
alter table recommendations enable row level security;
alter table recommendations force row level security;
alter table audit_events enable row level security;
alter table audit_events force row level security;

-- events: append-only (insert + select; no update/delete) to preserve immutability.
create policy events_select on events for select
  using (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy events_insert on events for insert
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());

-- audit_events: append-only.
create policy audit_events_select on audit_events for select
  using (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy audit_events_insert on audit_events for insert
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());

-- agent_runs / agent_actions / recommendations: full tenant isolation (no delete policy => no deletes).
create policy agent_runs_isolation on agent_runs
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy agent_actions_isolation on agent_actions
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy recommendations_isolation on recommendations
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
