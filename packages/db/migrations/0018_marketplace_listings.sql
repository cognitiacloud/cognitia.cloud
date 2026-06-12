-- 0018_marketplace_listings.sql
-- AGENT-ECONOMY-004: the internal marketplace skeleton.
--
-- 001 deliberately deferred a listings table ("agents + skills + work orders
-- ARE the marketplace at lab stage; a listings/pricing table can layer on
-- once matching needs it"). Tier-aware matching now needs it.
--
-- Doctrine:
--   * INTERNAL ONLY: visibility is check-locked to 'internal' — a public
--     marketplace does not exist, exactly like wallet statuses are locked.
--   * Listings tie to a SPECIFIC SkillProof skill version: tier and yank
--     state live there. Yanked versions cannot be listed (trigger).
--   * Prices are internal credits (bookkeeping units); ordering from a
--     listing creates a normal work order — escrow, proofs, release rules
--     all unchanged. No real payments, no token anywhere.
-- RLS: tenant-scoped, same helpers as 0001.

create table marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  skill_version_id uuid not null references skill_versions(id) on delete cascade,
  price_credits bigint not null check (price_credits > 0),
  summary text,
  status text not null default 'active'
    check (status in ('active', 'withdrawn')),
  visibility text not null default 'internal'
    check (visibility in ('internal')), -- the ONLY legal visibility
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_id, skill_version_id)
);
comment on table marketplace_listings is
  'Internal marketplace skeleton (AGENT-ECONOMY-004). visibility check-locked to internal; a public marketplace does not exist.';

-- Yanked skill versions take no new listings (matching also re-checks).
create or replace function marketplace_listings_guard() returns trigger
language plpgsql as $$
declare v skill_versions%rowtype;
begin
  select * into v from skill_versions where id = new.skill_version_id;
  if not found or v.tenant_id <> new.tenant_id then
    raise exception 'marketplace_listing %: skill version % not found for tenant',
      new.id, new.skill_version_id;
  end if;
  if v.skill_id <> new.skill_id then
    raise exception 'marketplace_listing %: skill_version % does not belong to skill %',
      new.id, new.skill_version_id, new.skill_id;
  end if;
  if v.yanked and new.status = 'active' then
    raise exception 'marketplace_listing %: yanked skill versions cannot be listed', new.id;
  end if;
  return new;
end;
$$;
create trigger trg_marketplace_listings_guard before insert or update on marketplace_listings
  for each row execute function marketplace_listings_guard();
create trigger trg_marketplace_listings_updated before update on marketplace_listings
  for each row execute function set_updated_at();

create index idx_marketplace_listings_tenant on marketplace_listings (tenant_id, status);

-- RLS
alter table marketplace_listings enable row level security;
alter table marketplace_listings force row level security;
create policy marketplace_listings_tenant_isolation on marketplace_listings
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
