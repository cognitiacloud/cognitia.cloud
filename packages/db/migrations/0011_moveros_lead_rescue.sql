-- 0011_moveros_lead_rescue.sql
-- Cognitia v1.1 Lane A: MoverOS AI Front Desk + Lead Rescue.
-- Inbound SMS-first lead intake (simulation-first), outcome tracking, and the
-- front-desk extensions to the existing agent_actions audit unit.
--
-- Doctrine (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md):
--   * Raw customer PII lives ONLY in lead_intakes, in *_enc columns
--     (application-layer encrypted/encoded), with purge capability
--     (PIPEDA / BC PIPA). Hashes elsewhere, never raw values.
--   * No real SMS without human approval: sms.% actions are simulation-first;
--     simulation defaults to true at the DB level for sms actions.
--   * Revenue outcomes carry evidence tags; only verified_fact counts publicly.

-- ---------------------------------------------------------------------------
-- lead_intakes: inbound mover leads. The ONLY table allowed to hold raw
-- (encrypted) customer PII. Optional link into the existing GTM leads table.
-- ---------------------------------------------------------------------------
create table lead_intakes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null, -- optional GTM linkage
  source text not null
    check (source in ('sms_sim', 'sms_real', 'web', 'manual')),
  channel_ref text,               -- provider message id when real channels exist
  contact_name_enc text,          -- app-layer encrypted; never plaintext
  contact_phone_enc text,         -- app-layer encrypted; never plaintext
  contact_phone_hash text,        -- lookup key, mirrors contacts.phone_hash pattern
  message_body_enc text,          -- app-layer encrypted; never plaintext
  received_at timestamptz not null default now(),
  consent_captured boolean not null default false,
  pii_status text not null default 'raw'
    check (pii_status in ('raw', 'redacted', 'purged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table lead_intakes is
  'Inbound MoverOS leads. Sole home of (encrypted) raw customer PII; purgeable for PIPEDA/BC PIPA.';
create trigger trg_lead_intakes_updated before update on lead_intakes
  for each row execute function set_updated_at();

-- Purged rows must actually be purged: pii_status='purged' forbids PII payloads.
alter table lead_intakes add constraint lead_intakes_purged_is_empty
  check (
    pii_status <> 'purged'
    or (contact_name_enc is null and contact_phone_enc is null and message_body_enc is null)
  );

-- ---------------------------------------------------------------------------
-- agent_actions front-desk extensions: simulation flag + proof linkage.
-- Columns are nullable so existing (non-front-desk) rows keep their semantics;
-- a trigger defaults simulation to TRUE for sms.% actions so nothing can slip
-- into a real send by omission.
-- ---------------------------------------------------------------------------
alter table agent_actions add column simulation boolean;
alter table agent_actions add column proof_id uuid references proofs(id);
comment on column agent_actions.simulation is
  'Front-desk doctrine: sms.% actions default to true (trigger); real sends require explicit false + sms.send_real allow + approval.';

create or replace function agent_actions_default_simulation() returns trigger
language plpgsql as $$
begin
  if new.action_type like 'sms.%' and new.simulation is null then
    new.simulation := true;
  end if;
  return new;
end;
$$;
create trigger trg_agent_actions_default_simulation before insert on agent_actions
  for each row execute function agent_actions_default_simulation();

-- ---------------------------------------------------------------------------
-- lead_outcomes: what actually happened. The vertical economic evidence.
-- booking_value_cents is business-sensitive: private by default, surfaces
-- publicly only via a verified_fact, redaction-checked proof.
-- ---------------------------------------------------------------------------
create table lead_outcomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_intake_id uuid not null references lead_intakes(id) on delete cascade,
  outcome text not null
    check (outcome in ('rescued', 'booked', 'lost', 'no_response', 'in_progress')),
  response_time_ms bigint check (response_time_ms is null or response_time_ms >= 0),
  booking_value_cents bigint check (booking_value_cents is null or booking_value_cents >= 0),
  currency text not null default 'CAD',
  evidence_tag text not null
    check (evidence_tag in ('verified_fact', 'likely_inference', 'unknown')),
  proof_id uuid references proofs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_lead_outcomes_updated before update on lead_outcomes
  for each row execute function set_updated_at();

-- Indexes
create index idx_lead_intakes_tenant on lead_intakes (tenant_id, received_at);
create index idx_lead_intakes_phone_hash on lead_intakes (tenant_id, contact_phone_hash);
create index idx_lead_outcomes_tenant on lead_outcomes (tenant_id, outcome, created_at);
create index idx_agent_actions_proof on agent_actions (tenant_id, proof_id);

-- RLS
alter table lead_intakes enable row level security;
alter table lead_intakes force row level security;
alter table lead_outcomes enable row level security;
alter table lead_outcomes force row level security;

create policy lead_intakes_isolation on lead_intakes
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy lead_outcomes_isolation on lead_outcomes
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
