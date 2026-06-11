-- 0012_credits_wallet.sql
-- Cognitia v1.1 Lane C (crypto-ready, legal-gated): internal credits with an
-- append-only double-entry ledger, and inert wallet-binding placeholders.
--
-- Doctrine (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md §5):
--   * Internal credits ONLY. payment rail enum exists; only internal_credits
--     is active. No Stripe, no stablecoin, no on-chain anything in v1.1.
--   * wallet_bindings are placeholders: status locked to 'placeholder',
--     chain defaults to 'none'. No signing, no custody, no transactions.
--   * Ledger entries are append-only (trigger-enforced); balances are derived,
--     never stored-and-mutated.
--   * No public token surface exists anywhere (doctrine guard tests).

-- ---------------------------------------------------------------------------
-- credits_accounts: internal credit account per owner (tenant, agent, ...).
-- ---------------------------------------------------------------------------
create table credits_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_type text not null check (owner_type in ('tenant', 'agent', 'system')),
  owner_id uuid not null,
  status text not null default 'active'
    check (status in ('active', 'frozen', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, owner_type, owner_id)
);
create trigger trg_credits_accounts_updated before update on credits_accounts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- credits_ledger_entries: append-only double-entry ledger. A transfer is a
-- balanced debit+credit pair sharing one idempotency_key (service layer writes
-- both rows in one transaction; uniqueness makes retries no-ops).
-- ---------------------------------------------------------------------------
create table credits_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid not null references credits_accounts(id),
  counter_account_id uuid not null references credits_accounts(id),
  amount bigint not null check (amount > 0),
  direction text not null check (direction in ('debit', 'credit')),
  rail text not null default 'internal_credits'
    check (rail in ('internal_credits', 'stripe_card', 'stablecoin', 'other_future')),
  reason_code text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key, direction),
  constraint ledger_distinct_accounts check (account_id <> counter_account_id)
);
comment on table credits_ledger_entries is
  'Append-only double-entry ledger. Balances are SUMs over entries; never mutate rows.';

-- v1.1: only the internal rail is live. Widen deliberately, never by default.
alter table credits_ledger_entries add constraint ledger_internal_rail_only
  check (rail = 'internal_credits');

create trigger trg_ledger_no_update before update on credits_ledger_entries
  for each row execute function forbid_update();
create trigger trg_ledger_no_delete before delete on credits_ledger_entries
  for each row execute function forbid_delete();

-- ---------------------------------------------------------------------------
-- wallet_bindings: inert placeholder for future wallet links (Base/EVM
-- optionality). Nothing here signs, custodies, or transacts.
-- ---------------------------------------------------------------------------
create table wallet_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_type text not null check (owner_type in ('tenant', 'agent')),
  owner_id uuid not null,
  chain text not null default 'none'
    check (chain in ('none', 'base', 'evm_other')),
  address text,                   -- pseudonymous; internal-only surface
  status text not null default 'placeholder'
    check (status in ('placeholder')), -- v1.1: placeholder is the ONLY legal status
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, owner_type, owner_id, chain)
);
comment on table wallet_bindings is
  'Inert placeholders (Lane C). status is locked to placeholder in v1.1; activation requires a deliberate future migration + legal gate.';
create trigger trg_wallet_bindings_updated before update on wallet_bindings
  for each row execute function set_updated_at();

-- Indexes
create index idx_credits_accounts_tenant on credits_accounts (tenant_id, owner_type, owner_id);
create index idx_ledger_tenant_account on credits_ledger_entries (tenant_id, account_id, created_at);
create index idx_wallet_bindings_tenant on wallet_bindings (tenant_id, owner_type, owner_id);

-- RLS
alter table credits_accounts enable row level security;
alter table credits_accounts force row level security;
alter table credits_ledger_entries enable row level security;
alter table credits_ledger_entries force row level security;
alter table wallet_bindings enable row level security;
alter table wallet_bindings force row level security;

create policy credits_accounts_isolation on credits_accounts
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
-- ledger: append-only (select + insert).
create policy ledger_select on credits_ledger_entries for select
  using (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy ledger_insert on credits_ledger_entries for insert
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
create policy wallet_bindings_isolation on wallet_bindings
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
