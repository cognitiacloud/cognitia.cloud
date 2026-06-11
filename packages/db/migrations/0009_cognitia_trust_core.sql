-- 0009_cognitia_trust_core.sql
-- Cognitia v1.1 Lane B core: agent registry, Agent Trust Credentials (ATC),
-- agent permissions, and the append-only Proof Registry with evidence tags.
--
-- Doctrine (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md):
--   * evidence_tag ∈ {verified_fact, likely_inference, unknown} on every proof.
--   * verified_fact requires evidence_ref AND verifier_ref.
--   * public_safe defaults to false and requires a passed redaction check.
--   * proofs are append-only; corrections supersede, never edit.
--   * no custom DID method; external refs are standards-compatible identifiers only.
-- RLS: tenant-scoped, same helpers as 0001.

-- ---------------------------------------------------------------------------
-- agents: registry of Cognitia-operated AI agents (no customer PII).
-- runtime_key links to the string identity used by agent_runs.agent.
-- ---------------------------------------------------------------------------
create table agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  runtime_key text,               -- matches agent_runs.agent (e.g. 'mira'); null until wired
  kind text not null default 'other'
    check (kind in ('front_desk', 'internal_ops', 'other')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'retired')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
comment on table agents is 'Registry of Cognitia-operated agents. No customer PII lives here.';

-- ---------------------------------------------------------------------------
-- agent_trust_credentials: the ATC. W3C-VC-style shape (issuer/subject/claims/
-- status/issuance/expiry) without cryptographic suites in v1.1.
-- external_ref is reserved for future standards-compatible identifiers
-- (ERC-8004 agent id, EAS attestation uid, existing DID methods). Never a
-- custom DID method.
-- ---------------------------------------------------------------------------
create table agent_trust_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  issuer text not null default 'cognitia.internal',
  subject_ref text not null,      -- agent:uuid
  claims jsonb not null default '{}'::jsonb, -- scope/vertical/policy refs; no customer PII
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  external_ref text,              -- future ERC-8004 / EAS / existing-method DID ref
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table agent_trust_credentials is
  'Cognitia Agent Trust Credential (ATC). VC-style; revoked is terminal.';

-- Revocation is terminal: a revoked ATC can never return to another status.
create or replace function atc_guard_status() returns trigger
language plpgsql as $$
begin
  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'ATC %: revoked credentials cannot change status', old.id;
  end if;
  return new;
end;
$$;
create trigger trg_atc_guard_status before update on agent_trust_credentials
  for each row execute function atc_guard_status();
create trigger trg_atc_updated before update on agent_trust_credentials
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- agent_permissions: policy of what an agent may do. Deny-by-default posture:
-- absence of an allow row means deny; explicit deny rows always win.
-- Doctrine: every agent gets an explicit ('sms.send_real', 'deny') row at
-- creation (service layer + seed enforce this).
-- ---------------------------------------------------------------------------
create table agent_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  action_key text not null,       -- e.g. sms.draft | sms.send_real | lead.read
  effect text not null check (effect in ('allow', 'deny')),
  constraints jsonb not null default '{}'::jsonb, -- rate limits, approval_required, ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_id, action_key)
);
create trigger trg_agent_permissions_updated before update on agent_permissions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- proofs: the Proof Registry. Append-only; the ONLY mutable columns are the
-- publish-state pair (public_safe, redaction_check_passed_at), so a redaction
-- pass can publish a proof without rewriting history. Everything else is
-- frozen at insert; corrections are new rows via supersedes_proof_id.
-- ---------------------------------------------------------------------------
create table proofs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null
    check (kind in ('lead_response', 'booking', 'skill_demo', 'revenue_outcome', 'system')),
  subject_type text not null,     -- agent | lead_intake | skill | agent_action ...
  subject_id uuid not null,
  evidence_tag text not null
    check (evidence_tag in ('verified_fact', 'likely_inference', 'unknown')),
  evidence_ref text,              -- artifact URI / log hash / record id
  verifier_ref text,              -- user:uuid | verifier:<whitelisted automation>
  summary_public text,            -- redacted text; the only narrative a public view may show
  details_private jsonb not null default '{}'::jsonb, -- never exposed publicly
  public_safe boolean not null default false,
  redaction_check_passed_at timestamptz,
  supersedes_proof_id uuid references proofs(id),
  external_attestation_ref text,  -- future EAS anchoring
  created_at timestamptz not null default now(),
  -- verified_fact must carry its evidence and its verifier.
  constraint proofs_verified_fact_requires_refs
    check (evidence_tag <> 'verified_fact' or (evidence_ref is not null and verifier_ref is not null)),
  -- nothing is public without a passed redaction check.
  constraint proofs_public_requires_redaction
    check (not public_safe or redaction_check_passed_at is not null)
);
comment on table proofs is
  'Append-only Proof Registry. Only public_safe/redaction_check_passed_at may change post-insert.';

create or replace function proofs_guard_update() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
    or new.tenant_id is distinct from old.tenant_id
    or new.kind is distinct from old.kind
    or new.subject_type is distinct from old.subject_type
    or new.subject_id is distinct from old.subject_id
    or new.evidence_tag is distinct from old.evidence_tag
    or new.evidence_ref is distinct from old.evidence_ref
    or new.verifier_ref is distinct from old.verifier_ref
    or new.summary_public is distinct from old.summary_public
    or new.details_private is distinct from old.details_private
    or new.supersedes_proof_id is distinct from old.supersedes_proof_id
    or new.external_attestation_ref is distinct from old.external_attestation_ref
    or new.created_at is distinct from old.created_at
  then
    raise exception 'proofs are append-only: only publish-state columns may change (proof %)', old.id;
  end if;
  return new;
end;
$$;
create trigger trg_proofs_guard_update before update on proofs
  for each row execute function proofs_guard_update();

create or replace function forbid_delete() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: delete is forbidden', tg_table_name;
end;
$$;
create trigger trg_proofs_forbid_delete before delete on proofs
  for each row execute function forbid_delete();

-- Indexes
create index idx_agents_tenant on agents (tenant_id, status);
create index idx_atc_tenant_agent on agent_trust_credentials (tenant_id, agent_id, status);
create index idx_agent_permissions_agent on agent_permissions (tenant_id, agent_id);
create index idx_proofs_tenant_subject on proofs (tenant_id, subject_type, subject_id);
create index idx_proofs_tenant_tag on proofs (tenant_id, evidence_tag, created_at);
create index idx_proofs_public on proofs (tenant_id, public_safe) where public_safe;

-- RLS
alter table agents enable row level security;
alter table agents force row level security;
alter table agent_trust_credentials enable row level security;
alter table agent_trust_credentials force row level security;
alter table agent_permissions enable row level security;
alter table agent_permissions force row level security;
alter table proofs enable row level security;
alter table proofs force row level security;

create policy agents_isolation on agents
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy atc_isolation on agent_trust_credentials
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy agent_permissions_isolation on agent_permissions
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
-- proofs: select + insert + update (update narrowed to publish-state by trigger); no delete policy.
create policy proofs_select on proofs for select
  using (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy proofs_insert on proofs for insert
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy proofs_update on proofs for update
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
