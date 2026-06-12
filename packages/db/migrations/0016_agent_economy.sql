-- 0016_agent_economy.sql
-- AGENT-ECONOMY-001: the Agent Economy Lab — internal, simulation-only.
--
-- The first closed-loop agent economy on the existing primitives: an agent
-- requests work (work_orders), another agent accepts, internal credits are
-- RESERVED into escrow, work is delivered as a SIMULATED skill execution
-- order, a proof is submitted, and escrow is released / refunded / disputed —
-- with release possible ONLY against a verified_fact proof (the economy
-- version of "only verified_fact counts").
--
-- Doctrine:
--   * internal credits remain the ONLY rail (0012 ledger_internal_rail_only
--     is untouched); escrow is just a new credits-account owner type.
--   * skill execution is SIMULATION-ONLY in the lab: the column is
--     check-locked to true, exactly like wallet statuses are check-locked.
--   * verified/rejected/canceled work orders are terminal; a transition to
--     'verified' (and escrow_status 'released') REQUIRES a verified_fact
--     proof — the trigger joins proofs, so the DATABASE refuses unproven
--     payouts even if every service layer above it is wrong.
--   * no token, no chain, no real payments anywhere in this migration.
-- RLS: tenant-scoped, same helpers as 0001.

-- Escrow accounts: a deliberate widening (0014 precedent — never edit 0012).
alter table credits_accounts drop constraint credits_accounts_owner_type_check;
alter table credits_accounts add constraint credits_accounts_owner_type_check
  check (owner_type in ('tenant', 'agent', 'system', 'escrow'));
comment on column credits_accounts.owner_type is
  'tenant | agent | system (grant source, may go negative) | escrow (0016: owner_id is the work order)';

-- ---------------------------------------------------------------------------
-- work_orders: a unit of agent-to-agent work.
-- Lifecycle: proposed -> accepted -> in_progress -> delivered ->
--            verified | rejected | disputed; proposed/accepted -> canceled.
-- ---------------------------------------------------------------------------
create table work_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  requester_agent_id uuid not null references agents(id),
  worker_agent_id uuid references agents(id),
  skill_version_id uuid references skill_versions(id),
  title text not null,
  description text,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'in_progress', 'delivered',
                      'verified', 'rejected', 'disputed', 'canceled')),
  requested_credits bigint not null check (requested_credits > 0),
  escrow_status text not null default 'none'
    check (escrow_status in ('none', 'reserved', 'released', 'refunded', 'disputed')),
  escrow_account_id uuid references credits_accounts(id),
  proof_required boolean not null default true,
  proof_id uuid references proofs(id),
  outcome_type text,
  -- Denormalized copy of the linked proof's tag for fast reads; the proof row
  -- stays the source of truth and the release trigger re-checks it there.
  evidence_tag text
    check (evidence_tag is null
           or evidence_tag in ('verified_fact', 'likely_inference', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table work_orders is
  'Agent Economy Lab work orders. Escrow in internal credits only; verified/rejected/canceled are terminal; verification requires a verified_fact proof (trigger).';

create or replace function work_orders_guard_update() returns trigger
language plpgsql as $$
declare tag text;
begin
  -- Terminal states never transition again (disputes resolve in a future
  -- migration, deliberately — not by silently flipping status).
  if old.status in ('verified', 'rejected', 'canceled')
     and new.status is distinct from old.status then
    raise exception 'work_order %: % is terminal', old.id, old.status;
  end if;
  -- The payout rule, enforced by the database itself: escrow may only be
  -- marked released — and the order verified — against a verified_fact proof.
  if (new.status = 'verified' and old.status <> 'verified')
     or (new.escrow_status = 'released' and old.escrow_status <> 'released') then
    if new.proof_id is null then
      raise exception 'work_order %: verification requires a proof', old.id;
    end if;
    select evidence_tag into tag from proofs where id = new.proof_id;
    if tag is distinct from 'verified_fact' then
      raise exception 'work_order %: escrow release requires a verified_fact proof (got %)',
        old.id, tag;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_work_orders_guard_update before update on work_orders
  for each row execute function work_orders_guard_update();
create trigger trg_work_orders_updated before update on work_orders
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- skill_execution_orders: one execution of a SkillProof skill version against
-- a work order. SIMULATION-ONLY in the lab — the column is check-locked.
-- ---------------------------------------------------------------------------
create table skill_execution_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  work_order_id uuid not null references work_orders(id) on delete cascade,
  worker_agent_id uuid not null references agents(id),
  skill_version_id uuid not null references skill_versions(id),
  status text not null default 'ordered'
    check (status in ('ordered', 'running', 'succeeded', 'failed')),
  simulation boolean not null default true
    check (simulation = true), -- the lab executes nothing for real
  result jsonb not null default '{}'::jsonb,
  proof_id uuid references proofs(id),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column skill_execution_orders.simulation is
  'Check-locked to true: lab executions are simulations. Real execution requires a deliberate future migration + the existing approval machinery.';
create trigger trg_skill_execution_orders_updated before update on skill_execution_orders
  for each row execute function set_updated_at();

-- Indexes
create index idx_work_orders_tenant_status on work_orders (tenant_id, status, created_at);
create index idx_work_orders_worker on work_orders (tenant_id, worker_agent_id);
create index idx_execution_orders_work_order on skill_execution_orders (tenant_id, work_order_id);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['work_orders','skill_execution_orders'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format(
      'create policy %I on %I using (app_bypass_rls() or tenant_id = app_current_tenant_id()) with check (app_bypass_rls() or tenant_id = app_current_tenant_id());',
      t || '_tenant_isolation', t);
  end loop;
end$$;
