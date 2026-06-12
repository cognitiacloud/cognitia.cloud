-- 0010: PASS-1 — agent passports + scope grants (identity-first execution).
-- Every non-human actor executes under an explicit, revocable passport, and
-- every executable action requires a live, narrow, owner-approved scope grant
-- (action_type × integration × max risk × expiry). Enforcement happens at the
-- single ledger.execute() chokepoint; denials are audited with a typed reason
-- (passport_missing / passport_revoked / grant_missing / grant_revoked /
-- grant_expired / grant_insufficient_risk).

create table agent_passports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id text not null,                  -- 'mira' | future agents
  owner_ref text not null,                 -- verified user ref of the issuer
  status text not null default 'active',   -- active | revoked | suspended
  key_ref text,                            -- future key binding; never raw secret
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_id)             -- one passport per agent per tenant
);
comment on table agent_passports is
  'PASS-1: explicit, revocable identity for non-human actors. Execution authorizes against this, never the bare agent name.';

create table scope_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  passport_id uuid not null references agent_passports(id) on delete cascade,
  action_type text not null,               -- e.g. crm.task.create
  integration text not null,               -- e.g. hubspot
  risk_max text not null,                  -- none | low | medium | high (ceiling)
  status text not null default 'active',   -- active | revoked
  approved_by text not null,               -- owner (verified user ref), never the agent
  approved_at timestamptz not null,
  expires_at timestamptz not null,         -- grants always expire; no open-ended scope
  revoked_at timestamptz,
  revoked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table scope_grants is
  'PASS-1: narrow, expiring, owner-approved permission for one action_type × integration up to risk_max.';

create index idx_agent_passports_tenant on agent_passports (tenant_id, agent_id);
create index idx_scope_grants_passport on scope_grants (tenant_id, passport_id, status);

-- updated_at triggers (mutable tables)
create trigger trg_agent_passports_updated before update on agent_passports for each row execute function set_updated_at();
create trigger trg_scope_grants_updated before update on scope_grants for each row execute function set_updated_at();

-- RLS: full tenant isolation (no delete policy => no deletes via app role).
alter table agent_passports enable row level security;
alter table agent_passports force row level security;
alter table scope_grants enable row level security;
alter table scope_grants force row level security;

create policy agent_passports_tenant_isolation on agent_passports
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy scope_grants_tenant_isolation on scope_grants
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
