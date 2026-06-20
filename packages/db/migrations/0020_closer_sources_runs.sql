-- 0020_closer_sources_runs.sql
-- Sales Closer Intelligence Engine — ingestion foundation (Phase 1).
--
-- Extends the GTM platform; reuses agent_runs as the pipeline-run concept and
-- accounts as the dealership home. This migration adds only the Apify-specific
-- tables that have no existing home:
--   - closer_sources       : Apify import configs (actor + input + risk tag)
--   - closer_scrape_runs    : thin child of agent_runs holding Apify run metadata
--   - closer_raw_records    : staging rows for normalize/dedupe (idempotent ingest)
--
-- RLS: every table tenant-scoped via app_current_tenant_id() (helpers from 0001).
-- Safety: source_risk is explicit; a 'disallowed' source can never be active and
-- a scrape run can never run a 'disallowed' source (check-enforced + repo-mirrored).
-- No raw contact PII is stored here.
-- Fixture: packages/db/fixtures/closer.fixture.sql

create table closer_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  label text not null,
  apify_actor_id text not null,
  input jsonb not null default '{}'::jsonb,
  -- Source risk classification gates what may run (Phase 2 enforces vendor calls).
  source_risk text not null
    check (source_risk in ('safe_public_website_crawl', 'prototype_only', 'legal_review_required', 'disallowed')),
  max_results int not null default 100 check (max_results > 0),
  schedule text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A disallowed source can never be active.
  constraint closer_sources_disallowed_not_active check (not (active and source_risk = 'disallowed'))
);
comment on table closer_sources is 'Apify import configs for Sales Closer. source_risk gates execution; disallowed is never active.';

create table closer_scrape_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  -- The pipeline run IS an agent_run (agent = closer); this row holds Apify metadata.
  agent_run_id uuid not null references agent_runs(id) on delete cascade,
  source_id uuid references closer_sources(id) on delete set null,
  apify_run_id text,
  dataset_id text,
  source_risk text not null
    check (source_risk in ('safe_public_website_crawl', 'prototype_only', 'legal_review_required'))
    -- 'disallowed' is intentionally absent: a disallowed source can never produce a run.
  ,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  stage text not null default 'run_actor',
  rows_in int not null default 0,
  accounts_upserted int not null default 0,
  contacts_upserted int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table closer_scrape_runs is 'Apify run metadata for a Sales Closer pipeline run (1:1 with an agent_run).';

create table closer_raw_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  scrape_run_id uuid not null references closer_scrape_runs(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  normalized jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  account_id uuid references accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Re-ingesting the same source row is a no-op (idempotent ingest).
  unique (tenant_id, scrape_run_id, dedupe_key)
);
comment on table closer_raw_records is 'Staging rows from an Apify dataset, normalized then linked to a deduped account.';

-- Indexes
create index idx_closer_sources_tenant on closer_sources (tenant_id, active);
create index idx_closer_scrape_runs_tenant on closer_scrape_runs (tenant_id, status);
create index idx_closer_scrape_runs_agent_run on closer_scrape_runs (tenant_id, agent_run_id);
create index idx_closer_raw_records_run on closer_raw_records (tenant_id, scrape_run_id);
create index idx_closer_raw_records_dedupe on closer_raw_records (tenant_id, dedupe_key);

-- updated_at triggers (closer_raw_records is insert + link only; no updated_at)
create trigger trg_closer_sources_updated before update on closer_sources
  for each row execute function set_updated_at();
create trigger trg_closer_scrape_runs_updated before update on closer_scrape_runs
  for each row execute function set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['closer_sources', 'closer_scrape_runs', 'closer_raw_records'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format(
      'create policy %I on %I using (app_bypass_rls() or tenant_id = app_current_tenant_id()) with check (app_bypass_rls() or tenant_id = app_current_tenant_id());',
      t || '_tenant_isolation', t);
  end loop;
end$$;
