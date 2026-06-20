-- 0021_closer_profiles_briefs.sql
-- Sales Closer Intelligence Engine — scoring + brief foundation (Phase 1).
--
-- Reuses accounts.fit_score/timing_score for those two dimensions and the
-- append-only events table for score history. Adds only:
--   - closer_account_profiles : 1:1 typed dealership/closer fields + latest score
--   - closer_briefs           : the closer brief artifact (markdown + structured + claims)
--
-- RLS: tenant-scoped via app_current_tenant_id() (helpers from 0001).
-- Evidence doctrine: every brief claim carries an evidence_tag; verified_fact
-- claims require an evidence_ref. Because claims live in a jsonb array, that rule
-- is enforced in packages/core (closer.ts zod), the repository, and a guard test
-- (mirroring how proofs enforce verified_fact at multiple layers).
-- No raw contact PII is stored here; briefs reference contacts by persona/title.

create table closer_account_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  tier text check (tier in ('A', 'B', 'C', 'D')),
  score numeric,
  -- fit / intent / timing / reachability (0..1)
  dimensions jsonb not null default '{}'::jsonb,
  rationale text,
  model text,
  -- Dealership-specific typed fields (no existing home on accounts).
  crm_vendor text,
  monthly_lead_volume int,
  rooftops int,
  oem_brands jsonb not null default '[]'::jsonb,
  funnel_audit jsonb not null default '{}'::jsonb,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, account_id)
);
comment on table closer_account_profiles is 'Per-account Sales Closer profile: dealership fields + latest tier/score. History lives in events.';

create table closer_briefs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  agent_run_id uuid references agent_runs(id) on delete set null,
  model text,
  content_md text not null,
  -- pains / hooks / objections / talk_track / recommended_offer
  structured jsonb not null default '{}'::jsonb,
  -- [{ text, evidence_tag, evidence_ref?, confidence? }] — verified_fact requires evidence_ref (app-enforced)
  claims jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table closer_briefs is 'Closer brief artifact. Approval/handoff flows through agent_actions; no raw contact PII.';

-- Indexes
create index idx_closer_account_profiles_tenant on closer_account_profiles (tenant_id, tier, score desc);
create index idx_closer_briefs_account on closer_briefs (tenant_id, account_id, created_at desc);

-- updated_at triggers
create trigger trg_closer_account_profiles_updated before update on closer_account_profiles
  for each row execute function set_updated_at();
create trigger trg_closer_briefs_updated before update on closer_briefs
  for each row execute function set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['closer_account_profiles', 'closer_briefs'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format(
      'create policy %I on %I using (app_bypass_rls() or tenant_id = app_current_tenant_id()) with check (app_bypass_rls() or tenant_id = app_current_tenant_id());',
      t || '_tenant_isolation', t);
  end loop;
end$$;
