-- 0013_skillproof_frontdesk_ext.sql
-- Mission Pack B (COG-005 + COG-006) extensions on top of 0010/0011.
--
-- COG-005 SkillProof Core 20: provenance + certification state on skills and
-- versions (namespace, source paths, content hashes, numeric proof tier 0–4,
-- yank). Tiers 0–2 are implemented; 3–4 are legal enum values but nothing in
-- v1.1 may assign them (service-enforced; no faked production proof).
--
-- COG-006 Lead Rescue: lead lifecycle status, extended outcome vocabulary,
-- estimated value, and evidence_source for outcome claims.
--
-- Doctrine: skills stay internal (0010 check unchanged); tier >= 2 requires a
-- verified_fact proof (trigger below); only verified_fact outcomes may move
-- reputation (0010 trigger already enforces).

-- ---------------------------------------------------------------------------
-- COG-005: skills provenance
-- ---------------------------------------------------------------------------
alter table skills add column namespace text not null default 'cognitia.core';
alter table skills add column source_path text;              -- repo-relative or null (seeded)
alter table skills add column owner_agent_id uuid references agents(id) on delete set null;

alter table skill_versions add column manifest_hash text;    -- sha256 of manifest (skill.yaml etc.)
alter table skill_versions add column content_hash text;     -- sha256 over source content
alter table skill_versions add column metadata jsonb not null default '{}'::jsonb; -- x_cognitia_metadata
alter table skill_versions add column proof_tier integer not null default 0
  check (proof_tier between 0 and 4);
alter table skill_versions add column yanked boolean not null default false;
alter table skill_versions add column yank_reason text;
comment on column skill_versions.proof_tier is
  'SkillProof tier: 0 registered, 1 manifest/source verified, 2 verified_fact proof, 3 production-proven (NOT assignable in v1.1), 4 security-audited (NOT assignable in v1.1).';

-- Tier >= 2 requires a verified_fact proof certifying this version''s skill.
create or replace function skill_versions_guard_tier() returns trigger
language plpgsql as $$
declare
  ok boolean;
begin
  if new.proof_tier >= 2 and (old.proof_tier is null or new.proof_tier > old.proof_tier) then
    select exists (
      select 1
      from skill_proofs sp
      join proofs p on p.id = sp.proof_id
      where sp.skill_id = new.skill_id
        and sp.tenant_id = new.tenant_id
        and p.evidence_tag = 'verified_fact'
    ) into ok;
    if not ok then
      raise exception 'skill version %: tier % requires a verified_fact proof', new.id, new.proof_tier;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_skill_versions_guard_tier before update on skill_versions
  for each row execute function skill_versions_guard_tier();

-- ---------------------------------------------------------------------------
-- COG-006: lead lifecycle + outcomes vocabulary
-- ---------------------------------------------------------------------------
alter table lead_intakes add column status text not null default 'new'
  check (status in (
    'new', 'needs_response', 'agent_action_proposed', 'human_review_required',
    'contacted_simulated', 'callback_scheduled', 'booking_intent_created',
    'booked', 'lost', 'purged'
  ));

-- Widen the outcome vocabulary (union of 0011 values + Mission Pack B set).
alter table lead_outcomes drop constraint lead_outcomes_outcome_check;
alter table lead_outcomes add constraint lead_outcomes_outcome_check
  check (outcome in (
    -- 0011 originals (kept so no data rewrite is ever needed)
    'rescued', 'booked', 'lost', 'no_response', 'in_progress',
    -- Mission Pack B vocabulary
    'rescued_lead', 'booking_intent', 'booked_job', 'lost_lead',
    'invalid_lead', 'human_handoff', 'unknown'
  ));

alter table lead_outcomes add column estimated_value_cents bigint
  check (estimated_value_cents is null or estimated_value_cents >= 0);
alter table lead_outcomes add column evidence_source text; -- e.g. crm:deal:123, operator_assertion
comment on column lead_outcomes.evidence_source is
  'What backs the claim. verified_fact outcomes need a real source; operator assertions are likely_inference at best.';

create index idx_lead_intakes_status on lead_intakes (tenant_id, status);
