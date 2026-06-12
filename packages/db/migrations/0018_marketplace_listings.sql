-- 0018_marketplace_listings.sql
-- AGENT-ECONOMY-004: internal marketplace listings + tier-aware matching.
--
-- The first discoverable marketplace skeleton for the Agent Economy Lab.
-- A listing is an internal OFFER of an agent service / skill / workflow.
--
-- Doctrine (structural, defense-in-depth — the DB itself refuses the bad cases):
--   * visibility is internal | tenant | private ONLY. There is NO 'public'
--     value — the CHECK constraint makes a public marketplace unrepresentable.
--   * there is NO price column of any kind. The only money-shaped fields are
--     an internal-credits ESTIMATE range (min/max), never a token amount.
--   * a listing never moves credits or reputation by itself; only completed,
--     verified_fact-proven work does (the 0016/0010 triggers still own payout).
--   * still internal credits only; still no real payments, no token transfer.

create table marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  listing_type text not null check (listing_type in (
    'agent_service', 'skill_execution', 'workflow', 'verifier_service',
    'research_task', 'gtm_task', 'support_task', 'internal_only'
  )),
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'yanked', 'archived')),
  -- No 'public' value exists: a public marketplace is unrepresentable here.
  visibility text not null default 'internal'
    check (visibility in ('internal', 'tenant', 'private')),
  owner_agent_id uuid references agents(id) on delete set null,
  skill_version_id uuid references skill_versions(id) on delete set null,
  workflow_ref text,
  required_proof_tier int check (required_proof_tier between 0 and 4),
  minimum_reputation_score bigint,
  -- Internal-credits ESTIMATE range only. Not a price. Not a token amount.
  requested_credits_min bigint check (requested_credits_min >= 0),
  requested_credits_max bigint check (requested_credits_max >= 0),
  allowed_tenant_scope text not null default 'tenant'
    check (allowed_tenant_scope in ('internal', 'tenant', 'private')),
  risk_level text not null default 'low'
    check (risk_level in ('none', 'low', 'medium', 'high')),
  proof_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A declared credits range must be coherent.
  check (requested_credits_min is null or requested_credits_max is null
         or requested_credits_min <= requested_credits_max)
);
comment on table marketplace_listings is
  'AGENT-ECONOMY-004: internal marketplace offers. Visibility internal|tenant|private only (no public). No price column — internal credits estimate range only. Listings never move credits/reputation by themselves.';

-- Link a work order back to the listing it was created from (nullable: most
-- orders are created directly, not from a listing).
alter table work_orders add column listing_id uuid references marketplace_listings(id);
comment on column work_orders.listing_id is
  '0018: the internal marketplace listing this work order was created from (nullable).';

create index idx_marketplace_listings_tenant on marketplace_listings (tenant_id, status, listing_type);
create index idx_marketplace_listings_owner on marketplace_listings (tenant_id, owner_agent_id);

create trigger trg_marketplace_listings_updated before update on marketplace_listings
  for each row execute function set_updated_at();

-- RLS: tenant isolation (same pattern as every other table).
alter table marketplace_listings enable row level security;
alter table marketplace_listings force row level security;
create policy marketplace_listings_tenant_isolation on marketplace_listings
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
