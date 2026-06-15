-- 0019_agent_fabric_nodes.sql
-- LEGEND-001: the Agent Fabric Lab — internal, simulation-only.
--
-- A "node" is a registry record describing where agent work COULD run
-- (this machine, that machine, a cloud worker). At lab stage it is pure
-- metadata: the fabric ROUTES work to a node and records a SIMULATED execution
-- receipt as a normal Proof (kind 'fabric_execution_receipt'); it executes
-- NOTHING for real.
--
-- Doctrine (mirrors the Agent Economy Lab, 0016):
--   * SIMULATION ONLY: there is no network, no remote command execution, no
--     process spawn. Real distributed execution requires a deliberate future
--     migration + the existing approval machinery + a security sign-off. Until
--     then this table is a registry, not an execution surface.
--   * Receipts are PROOFS: execution evidence flows through the append-only
--     Proof Registry (0009); only a verified_fact proof releases escrow /
--     reputation, exactly as today. The fabric adds no new value-movement path.
--   * status is check-locked to active | quarantined: quarantine is the
--     per-node kill switch (a quarantined node takes no new routing).
--   * capabilities is declarative metadata (array of { skill, tier }); the real
--     gate on value is still the verified_fact proof, never a self-declared tier.
-- RLS: tenant-scoped, same helpers as 0001.

create table fabric_nodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  label text not null,
  platform text not null
    check (platform in ('macos', 'windows', 'linux', 'cloud')),
  status text not null default 'active'
    check (status in ('active', 'quarantined')),
  capabilities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_id, label)
);
comment on table fabric_nodes is
  'Agent Fabric Lab node registry (LEGEND-001). Simulation-only metadata: the fabric routes + records simulated receipts as proofs; it executes nothing for real. status=quarantined is the per-node kill switch.';
comment on column fabric_nodes.capabilities is
  'Declarative array of { skill, tier }. Self-declared; the real gate on value remains the verified_fact proof, never a declared tier.';

create trigger trg_fabric_nodes_updated before update on fabric_nodes
  for each row execute function set_updated_at();

create index idx_fabric_nodes_tenant on fabric_nodes (tenant_id, status);

-- RLS
alter table fabric_nodes enable row level security;
alter table fabric_nodes force row level security;
create policy fabric_nodes_tenant_isolation on fabric_nodes
  using (app_bypass_rls() or tenant_id = app_current_tenant_id())
  with check (app_bypass_rls() or tenant_id = app_current_tenant_id());
