-- 0005_campaigns_sequences_touchpoints.sql
-- Outbound program model: campaigns, segments, sequences, steps, touchpoints,
-- conversations.
--
-- RLS: tenant-scoped via app_current_tenant_id().
-- Fixture: packages/db/fixtures/tenant_isolation.fixture.sql

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  status text not null default 'draft', -- draft | active | paused | archived
  mode text not null default 'crm_task', -- crm_task | email_send (tenant execution mode)
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column campaigns.mode is
  'Execution mode: crm_task creates CRM tasks; email_send routes through email adapter on approval.';

create table audience_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  definition jsonb not null default '{}'::jsonb, -- targeting predicate
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sequences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sequence_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sequence_id uuid not null references sequences(id) on delete cascade,
  step_order int not null,
  channel text not null default 'email', -- email | task
  delay_days int not null default 0,
  template_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sequence_id, step_order)
);

create table touchpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sequence_step_id uuid references sequence_steps(id) on delete set null,
  contact_id uuid references contacts(id) on delete cascade,
  agent_action_id uuid references agent_actions(id) on delete set null,
  status text not null default 'planned', -- planned | scheduled | sent | replied | bounced
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column touchpoints.agent_action_id is 'Links a sent touch back to its audited action.';

create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  last_reply_class text, -- interested | not_interested | unsubscribe | wrong_person | ...
  status text not null default 'open', -- open | closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_campaigns_tenant on campaigns (tenant_id, status);
create index idx_audience_segments_tenant on audience_segments (tenant_id);
create index idx_sequences_tenant on sequences (tenant_id);
create index idx_sequence_steps_tenant on sequence_steps (tenant_id, sequence_id);
create index idx_touchpoints_tenant on touchpoints (tenant_id, status);
create index idx_touchpoints_contact on touchpoints (tenant_id, contact_id);
create index idx_conversations_tenant on conversations (tenant_id, status);

-- updated_at triggers
create trigger trg_campaigns_updated before update on campaigns for each row execute function set_updated_at();
create trigger trg_audience_segments_updated before update on audience_segments for each row execute function set_updated_at();
create trigger trg_sequences_updated before update on sequences for each row execute function set_updated_at();
create trigger trg_sequence_steps_updated before update on sequence_steps for each row execute function set_updated_at();
create trigger trg_touchpoints_updated before update on touchpoints for each row execute function set_updated_at();
create trigger trg_conversations_updated before update on conversations for each row execute function set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['campaigns','audience_segments','sequences','sequence_steps','touchpoints','conversations'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format(
      'create policy %I on %I using (app_bypass_rls() or tenant_id = app_current_tenant_id()) with check (app_bypass_rls() or tenant_id = app_current_tenant_id());',
      t || '_tenant_isolation', t);
  end loop;
end$$;
