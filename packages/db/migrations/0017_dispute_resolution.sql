-- 0017_dispute_resolution.sql
-- AGENT-ECONOMY-002: owner-arbitrated dispute resolution for Agent Economy
-- Lab work orders.
--
-- 0016 deliberately left disputes terminal-with-held-escrow. This migration
-- adds the resolution path the 0016 comments promised: a deliberate widening
-- (0014 precedent — never edit history) plus an append-only arbitration
-- record.
--
-- Doctrine:
--   * a dispute resolves ONLY from 'disputed', ONLY into 'resolved', and
--     ONLY against a verified_fact RESOLUTION proof (trigger joins proofs —
--     the DB refuses unproven arbitration, same as it refuses unproven
--     payouts).
--   * the arbitration math is conserved: worker_credits + requester_credits
--     must equal the order's requested_credits (trigger-checked).
--   * dispute_resolutions are append-only, one per work order.
--   * still internal credits only; still no real payments, no token.

-- Widen work_orders: 'resolved' status + escrow state, and the resolution
-- proof column. (Postgres auto-named the 0016 inline checks.)
alter table work_orders add column resolution_proof_id uuid references proofs(id);
alter table work_orders drop constraint work_orders_status_check;
alter table work_orders add constraint work_orders_status_check
  check (status in ('proposed', 'accepted', 'in_progress', 'delivered',
                    'verified', 'rejected', 'disputed', 'canceled', 'resolved'));
alter table work_orders drop constraint work_orders_escrow_status_check;
alter table work_orders add constraint work_orders_escrow_status_check
  check (escrow_status in ('none', 'reserved', 'released', 'refunded', 'disputed', 'resolved'));
comment on column work_orders.resolution_proof_id is
  '0017: verified_fact proof of the arbitration decision; required to enter status=resolved.';

-- Extend the update guard: 'resolved' joins the terminal set, and entering it
-- requires disputed origin + a verified_fact resolution proof.
create or replace function work_orders_guard_update() returns trigger
language plpgsql as $$
declare tag text;
begin
  if old.status in ('verified', 'rejected', 'canceled', 'resolved')
     and new.status is distinct from old.status then
    raise exception 'work_order %: % is terminal', old.id, old.status;
  end if;
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
  if new.status = 'resolved' and old.status <> 'resolved' then
    if old.status <> 'disputed' then
      raise exception 'work_order %: only disputed orders can be resolved (was %)',
        old.id, old.status;
    end if;
    if new.resolution_proof_id is null then
      raise exception 'work_order %: resolution requires a resolution proof', old.id;
    end if;
    select evidence_tag into tag from proofs where id = new.resolution_proof_id;
    if tag is distinct from 'verified_fact' then
      raise exception 'work_order %: resolution requires a verified_fact proof (got %)',
        old.id, tag;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- dispute_resolutions: the append-only arbitration record. One per order.
-- ---------------------------------------------------------------------------
create table dispute_resolutions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  work_order_id uuid not null references work_orders(id) on delete cascade,
  decision text not null check (decision in ('release', 'refund', 'split')),
  reason_code text not null,
  note text,
  worker_credits bigint not null check (worker_credits >= 0),
  requester_credits bigint not null check (requester_credits >= 0),
  resolved_by text not null,           -- user:role — the arbiter, never PII
  proof_id uuid not null references proofs(id),
  created_at timestamptz not null default now(),
  unique (work_order_id)
);
comment on table dispute_resolutions is
  'Append-only arbitration records. Conserved math (worker+requester = requested_credits) and disputed-origin are trigger-checked.';

create or replace function dispute_resolutions_guard_insert() returns trigger
language plpgsql as $$
declare wo work_orders%rowtype;
begin
  select * into wo from work_orders where id = new.work_order_id;
  if not found or wo.tenant_id <> new.tenant_id then
    raise exception 'dispute_resolution %: work order % not found for tenant',
      new.id, new.work_order_id;
  end if;
  if wo.status <> 'disputed' then
    raise exception 'dispute_resolution %: work order % is not disputed (status %)',
      new.id, new.work_order_id, wo.status;
  end if;
  if new.worker_credits + new.requester_credits <> wo.requested_credits then
    raise exception 'dispute_resolution %: split must conserve escrow (% + % <> %)',
      new.id, new.worker_credits, new.requester_credits, wo.requested_credits;
  end if;
  if new.decision = 'release' and new.requester_credits <> 0 then
    raise exception 'dispute_resolution %: release means everything to the worker', new.id;
  end if;
  if new.decision = 'refund' and new.worker_credits <> 0 then
    raise exception 'dispute_resolution %: refund means everything to the requester', new.id;
  end if;
  return new;
end;
$$;
create trigger trg_dispute_resolutions_guard_insert before insert on dispute_resolutions
  for each row execute function dispute_resolutions_guard_insert();
create trigger trg_dispute_resolutions_forbid_update before update on dispute_resolutions
  for each row execute function forbid_update();
create trigger trg_dispute_resolutions_forbid_delete before delete on dispute_resolutions
  for each row execute function forbid_delete();

create index idx_dispute_resolutions_tenant on dispute_resolutions (tenant_id, created_at);

-- RLS
alter table dispute_resolutions enable row level security;
alter table dispute_resolutions force row level security;
create policy dispute_resolutions_tenant_isolation on dispute_resolutions
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
