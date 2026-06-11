-- 0010_skillproof_reputation.sql
-- Cognitia v1.1: SkillProof (private internal skill inventory + certification)
-- and Reputation v0 (events derived from proofs, periodic snapshots).
--
-- Doctrine (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md):
--   * NOT a public skill registry: visibility is locked to 'internal' in v1.1.
--   * Skill certification tiers T2+ require a verified_fact proof.
--   * Only verified_fact proofs may yield a POSITIVE reputation delta —
--     enforced here at the database level, not just in services.
--   * reputation_events are append-only.

-- ---------------------------------------------------------------------------
-- skills: private internal inventory (SkillProof Core 20 seeds land here).
-- ---------------------------------------------------------------------------
create table skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  category text not null default 'general',
  description text,
  visibility text not null default 'internal'
    check (visibility in ('internal')), -- widen deliberately in a future migration, never by default
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
comment on table skills is 'Private internal skill inventory. Not a public registry (doctrine).';
create trigger trg_skills_updated before update on skills
  for each row execute function set_updated_at();

create table skill_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  version text not null,          -- semver
  spec jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('draft', 'active', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, skill_id, version)
);
create trigger trg_skill_versions_updated before update on skill_versions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- skill_proofs: certification that an agent holds a skill at a tier, backed by
-- a Proof Registry row. Tiers T2_verified+ require the linked proof to be
-- verified_fact (DB-enforced).
-- ---------------------------------------------------------------------------
create table skill_proofs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  proof_id uuid not null references proofs(id),
  tier text not null default 'T0_claimed'
    check (tier in ('T0_claimed', 'T1_demonstrated', 'T2_verified', 'T3_economically_proven')),
  evidence_tag text not null
    check (evidence_tag in ('verified_fact', 'likely_inference', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_skill_proofs_updated before update on skill_proofs
  for each row execute function set_updated_at();

create or replace function skill_proofs_guard_tier() returns trigger
language plpgsql as $$
declare
  linked_tag text;
begin
  if new.tier in ('T2_verified', 'T3_economically_proven') then
    select evidence_tag into linked_tag from proofs where id = new.proof_id;
    if linked_tag is distinct from 'verified_fact' then
      raise exception 'skill_proof tier % requires a verified_fact proof (got %)', new.tier, linked_tag;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_skill_proofs_guard_tier before insert or update on skill_proofs
  for each row execute function skill_proofs_guard_tier();

-- ---------------------------------------------------------------------------
-- reputation_events: append-only inputs to reputation. THE doctrine rule:
-- a positive delta is only legal when the referenced proof is verified_fact.
-- ---------------------------------------------------------------------------
create table reputation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  proof_id uuid not null references proofs(id),
  delta numeric not null,
  reason_code text not null,
  created_at timestamptz not null default now()
);
comment on table reputation_events is
  'Append-only. Positive delta requires the referenced proof to be verified_fact (trigger-enforced).';

-- forbid_update helper (companion to forbid_delete from 0009).
create or replace function forbid_update() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: update is forbidden', tg_table_name;
end;
$$;

create or replace function reputation_events_guard() returns trigger
language plpgsql as $$
declare
  linked_tag text;
begin
  if new.delta > 0 then
    select evidence_tag into linked_tag from proofs where id = new.proof_id;
    if linked_tag is distinct from 'verified_fact' then
      raise exception 'positive reputation requires a verified_fact proof (proof % is %)', new.proof_id, linked_tag;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_reputation_events_guard before insert on reputation_events
  for each row execute function reputation_events_guard();
create trigger trg_reputation_events_no_update before update on reputation_events
  for each row execute function forbid_update();
create trigger trg_reputation_events_no_delete before delete on reputation_events
  for each row execute function forbid_delete();

-- ---------------------------------------------------------------------------
-- reputation_snapshots: periodic computed score per agent; reproducible from
-- events (inputs_hash records what went in). Insert-only by convention.
-- ---------------------------------------------------------------------------
create table reputation_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  score numeric not null,
  computed_at timestamptz not null default now(),
  inputs_hash text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_skills_tenant on skills (tenant_id, category);
create index idx_skill_proofs_tenant_agent on skill_proofs (tenant_id, agent_id, tier);
create index idx_reputation_events_tenant_agent on reputation_events (tenant_id, agent_id, created_at);
create index idx_reputation_snapshots_agent on reputation_snapshots (tenant_id, agent_id, computed_at);

-- RLS
alter table skills enable row level security;
alter table skills force row level security;
alter table skill_versions enable row level security;
alter table skill_versions force row level security;
alter table skill_proofs enable row level security;
alter table skill_proofs force row level security;
alter table reputation_events enable row level security;
alter table reputation_events force row level security;
alter table reputation_snapshots enable row level security;
alter table reputation_snapshots force row level security;

create policy skills_isolation on skills
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy skill_versions_isolation on skill_versions
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy skill_proofs_isolation on skill_proofs
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
-- reputation_events: append-only (select + insert).
create policy reputation_events_select on reputation_events for select
  using (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy reputation_events_insert on reputation_events for insert
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
-- reputation_snapshots: insert + select (recompute appends a new snapshot).
create policy reputation_snapshots_select on reputation_snapshots for select
  using (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy reputation_snapshots_insert on reputation_snapshots for insert
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
