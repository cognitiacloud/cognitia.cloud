-- 0015_field_provenance.sql
-- COG-016: field-level provenance for the canonical GTM entities.
--
-- Every canonical account/contact/opportunity field can carry WHERE a value
-- came from (source), HOW it was obtained (method), HOW MUCH to trust it
-- (evidence_tag + confidence), WHEN it was observed (recency), and a full
-- supersession history (corrections append, never edit — same discipline as
-- the 0009 Proof Registry).
--
-- Doctrine:
--   * rows are fully immutable: NO column may change post-insert; deletes
--     are forbidden. Corrections are new rows via supersedes_provenance_id.
--   * evidence_tag ∈ {verified_fact, likely_inference, unknown};
--     verified_fact requires evidence_ref AND verifier_ref (as in proofs).
--   * a supersession must target a row of the SAME tenant/entity/field, and
--     a row may be superseded at most once (the chain is linear).
--   * entity_type is account|contact|opportunity ONLY. lead_intake is
--     deliberately excluded: lead_intakes are workflow EVENTS, not canonical
--     leads — provenance attaches to the canonical record an event may
--     eventually update, never to the event itself.
--   * PII rule unchanged: contacts canonically store email_hash/phone_hash,
--     so provenance value snapshots for those fields are hashes too. Raw
--     PII never enters this table (service layer whitelists field names).
-- RLS: tenant-scoped, same helpers as 0001.

create table field_provenance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  entity_type text not null
    check (entity_type in ('account', 'contact', 'opportunity')),
  entity_id uuid not null,
  field_name text not null,
  -- Snapshot of the asserted value, as text (NULL = "field was cleared").
  -- For contact email/phone this is the HASH, mirroring 0003's PII rule.
  value_text text,
  -- WHERE the value came from: crm:hubspot | web:form | human:operator |
  -- agent:<slug> | enrichment:<vendor> | ...
  source text not null,
  -- HOW it was obtained. Closed vocabulary (doctrine, like proof kinds).
  method text not null
    check (method in ('ingest', 'human_entry', 'agent_inference', 'enrichment', 'verification')),
  evidence_tag text not null
    check (evidence_tag in ('verified_fact', 'likely_inference', 'unknown')),
  confidence numeric not null
    check (confidence >= 0 and confidence <= 1),
  evidence_ref text,           -- artifact URI / CRM record / log hash
  verifier_ref text,           -- user:uuid | verifier:<whitelisted automation>
  proof_id uuid references proofs(id),  -- optional Proof Registry link
  observed_at timestamptz not null,     -- recency: when the value was true at the source
  supersedes_provenance_id uuid references field_provenance(id),
  created_at timestamptz not null default now(),
  -- verified_fact must carry its evidence and its verifier (proofs doctrine).
  constraint field_provenance_verified_fact_requires_refs
    check (evidence_tag <> 'verified_fact'
           or (evidence_ref is not null and verifier_ref is not null))
);
comment on table field_provenance is
  'Append-only field-level provenance for canonical accounts/contacts/opportunities. Fully immutable; corrections supersede.';
comment on column field_provenance.entity_type is
  'account | contact | opportunity. lead_intake excluded by design: intakes are workflow events, not canonical leads.';

-- A provenance row may be superseded at most once: the history is a linear
-- chain, so "current" is well-defined per field.
create unique index uq_field_provenance_supersedes
  on field_provenance (supersedes_provenance_id)
  where supersedes_provenance_id is not null;

-- Supersession must stay on the same tenant + entity + field.
create or replace function field_provenance_guard_insert() returns trigger
language plpgsql as $$
declare prior field_provenance%rowtype;
begin
  if new.supersedes_provenance_id is not null then
    select * into prior from field_provenance where id = new.supersedes_provenance_id;
    if not found then
      raise exception 'field_provenance %: supersedes target % not found',
        new.id, new.supersedes_provenance_id;
    end if;
    if prior.tenant_id <> new.tenant_id
       or prior.entity_type <> new.entity_type
       or prior.entity_id <> new.entity_id
       or prior.field_name <> new.field_name then
      raise exception 'field_provenance %: supersession must target the same tenant/entity/field',
        new.id;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_field_provenance_guard_insert before insert on field_provenance
  for each row execute function field_provenance_guard_insert();

-- Fully immutable: every UPDATE is rejected (stricter than proofs, which
-- allow the publish-state pair — provenance has no publish state).
create or replace function field_provenance_forbid_update() returns trigger
language plpgsql as $$
begin
  raise exception 'field_provenance is append-only: updates are forbidden (row %)', old.id;
end;
$$;
create trigger trg_field_provenance_forbid_update before update on field_provenance
  for each row execute function field_provenance_forbid_update();
-- forbid_delete() ships with 0009.
create trigger trg_field_provenance_forbid_delete before delete on field_provenance
  for each row execute function forbid_delete();

-- Indexes: the read path is "history of one field" / "all fields of one entity".
create index idx_field_provenance_entity
  on field_provenance (tenant_id, entity_type, entity_id, field_name, observed_at desc);
create index idx_field_provenance_tenant_tag
  on field_provenance (tenant_id, evidence_tag, created_at);

-- RLS (same pattern as 0003/0009)
alter table field_provenance enable row level security;
alter table field_provenance force row level security;
create policy field_provenance_tenant_isolation on field_provenance
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
