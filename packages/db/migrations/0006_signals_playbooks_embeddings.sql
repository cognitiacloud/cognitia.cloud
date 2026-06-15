-- 0006_signals_playbooks_embeddings.sql
-- Intelligence + grounding: signals, playbooks (ICP), documents, chunks, and
-- pgvector embeddings for retrieval.
--
-- RLS: tenant-scoped via app_current_tenant_id().
-- Fixture: packages/db/fixtures/tenant_isolation.fixture.sql

create extension if not exists vector; -- pgvector

create table signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  signal_type text not null,       -- hiring | funding | tech_change | intent ...
  strength numeric,
  occurred_at timestamptz,
  source text,
  payload jsonb not null default '{}'::jsonb, -- refs/hashes, no raw PII
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table playbooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  icp jsonb not null default '{}'::jsonb, -- ideal customer profile predicate
  brand_voice jsonb not null default '{}'::jsonb,
  strategy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table playbooks is 'Tenant ICP + strategy + brand voice config consumed by agents.';

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text,
  source_ref text,                 -- where it came from
  kind text not null default 'doc',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, document_id, chunk_index)
);

create table embeddings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_chunk_id uuid not null references document_chunks(id) on delete cascade,
  embedding vector(1536),          -- model-dependent dimension
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_signals_tenant on signals (tenant_id, signal_type, occurred_at);
create index idx_signals_account on signals (tenant_id, account_id);
create index idx_playbooks_tenant on playbooks (tenant_id);
create index idx_documents_tenant on documents (tenant_id);
create index idx_document_chunks_tenant on document_chunks (tenant_id, document_id);
create index idx_embeddings_tenant on embeddings (tenant_id);
-- ANN index for retrieval (pgvector ivfflat; tune lists per data size).
create index idx_embeddings_vector on embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- updated_at triggers
create trigger trg_signals_updated before update on signals for each row execute function set_updated_at();
create trigger trg_playbooks_updated before update on playbooks for each row execute function set_updated_at();
create trigger trg_documents_updated before update on documents for each row execute function set_updated_at();
create trigger trg_document_chunks_updated before update on document_chunks for each row execute function set_updated_at();
create trigger trg_embeddings_updated before update on embeddings for each row execute function set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['signals','playbooks','documents','document_chunks','embeddings'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format(
      'create policy %I on %I using (app_bypass_rls() or tenant_id = app_current_tenant_id()) with check (app_bypass_rls() or tenant_id = app_current_tenant_id());',
      t || '_tenant_isolation', t);
  end loop;
end$$;
