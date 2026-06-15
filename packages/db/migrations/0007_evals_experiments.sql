-- 0007_evals_experiments.sql
-- Evaluation harness storage: experiments, eval runs, per-item results, and
-- human feedback labels.
--
-- RLS: tenant-scoped via app_current_tenant_id().
-- Fixture: packages/db/fixtures/tenant_isolation.fixture.sql

create table experiments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb, -- pinned prompt/model/policy versions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  experiment_id uuid references experiments(id) on delete cascade,
  dataset_ref text not null,
  status text not null default 'pending', -- pending | running | completed | failed
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table eval_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  eval_run_id uuid not null references eval_runs(id) on delete cascade,
  item_ref text not null,
  rubric text not null,            -- evidence_coverage | spamminess | brand_voice ...
  score numeric,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table feedback_labels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject_ref text not null,       -- agent_action:uuid | conversation:uuid ...
  label text not null,             -- approved | rejected | edited | reply_outcome ...
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_experiments_tenant on experiments (tenant_id);
create index idx_eval_runs_tenant on eval_runs (tenant_id, status);
create index idx_eval_items_tenant on eval_items (tenant_id, eval_run_id);
create index idx_eval_items_rubric on eval_items (tenant_id, rubric);
create index idx_feedback_labels_tenant on feedback_labels (tenant_id);
create index idx_feedback_labels_subject on feedback_labels (tenant_id, subject_ref);

-- updated_at triggers
create trigger trg_experiments_updated before update on experiments for each row execute function set_updated_at();
create trigger trg_eval_runs_updated before update on eval_runs for each row execute function set_updated_at();
create trigger trg_eval_items_updated before update on eval_items for each row execute function set_updated_at();
create trigger trg_feedback_labels_updated before update on feedback_labels for each row execute function set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['experiments','eval_runs','eval_items','feedback_labels'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format(
      'create policy %I on %I using (app_bypass_rls() or tenant_id = app_current_tenant_id()) with check (app_bypass_rls() or tenant_id = app_current_tenant_id());',
      t || '_tenant_isolation', t);
  end loop;
end$$;
