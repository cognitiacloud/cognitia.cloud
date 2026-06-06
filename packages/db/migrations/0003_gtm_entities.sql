-- 0003_gtm_entities.sql
-- Canonical GTM entities: accounts, contacts, leads, opportunities, meetings.
--
-- RLS: every table tenant-scoped via app_current_tenant_id().
-- PII: contact email/phone stored as hashes; raw values are never persisted here.
-- Fixture: packages/db/fixtures/tenant_isolation.fixture.sql

create table accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  domain text,
  industry text,
  employee_count int,
  region text,
  -- v0 scoring lives on the account for fast candidate selection.
  fit_score numeric,
  timing_score numeric,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table accounts is 'Target organizations. fit/timing scores set by Mira scoring v0.';

create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  full_name text,
  title text,
  persona text,
  email_hash text,   -- hash only (PII rule)
  phone_hash text,   -- hash only (PII rule)
  is_suppressed boolean not null default false, -- opt-out / suppression flag
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column contacts.is_suppressed is
  'When true, PolicyGate blocks proposing executable outreach to this contact.';

create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  source text,
  status text not null default 'new', -- new | qualified | disqualified
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  stage text not null default 'open',
  amount numeric,
  owner_ref text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  status text not null default 'scheduled', -- scheduled | held | no_show | canceled
  scheduled_at timestamptz,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_accounts_tenant on accounts (tenant_id);
create index idx_accounts_tenant_scores on accounts (tenant_id, fit_score desc, timing_score desc);
create index idx_contacts_tenant on contacts (tenant_id);
create index idx_contacts_account on contacts (tenant_id, account_id);
create index idx_contacts_suppressed on contacts (tenant_id, is_suppressed);
create index idx_leads_tenant on leads (tenant_id);
create index idx_opportunities_tenant on opportunities (tenant_id);
create index idx_opportunities_account on opportunities (tenant_id, account_id);
create index idx_meetings_tenant on meetings (tenant_id);

-- updated_at triggers
create trigger trg_accounts_updated before update on accounts for each row execute function set_updated_at();
create trigger trg_contacts_updated before update on contacts for each row execute function set_updated_at();
create trigger trg_leads_updated before update on leads for each row execute function set_updated_at();
create trigger trg_opportunities_updated before update on opportunities for each row execute function set_updated_at();
create trigger trg_meetings_updated before update on meetings for each row execute function set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['accounts','contacts','leads','opportunities','meetings'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format(
      'create policy %I on %I using (app_bypass_rls() or tenant_id = app_current_tenant_id()) with check (app_bypass_rls() or tenant_id = app_current_tenant_id());',
      t || '_tenant_isolation', t);
  end loop;
end$$;
