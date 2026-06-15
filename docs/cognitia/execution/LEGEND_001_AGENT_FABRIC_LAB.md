# LEGEND-001 — Agent Fabric Lab (execution record)

Date: 2026-06-15. Branch `claude/legend-001-agent-fabric-lab` from `main`
@ `313a82d`. Status: built, runtime-verified (local/dev), full gate green.

## What was built

The design-only distributed-agent-fabric (12H sprint LOOP 5) Stage 1 is now a
real, **simulation-only** lab wired into the existing Agent Economy — the same
way AGENT-ECONOMY-001 turned the economy design into a runtime-verified lab.

**No production deploy, no public token, no real payments, and — critically —
NO uncontrolled remote execution.** A "node" is a registry record; "execution"
is a pure in-process simulation. There is no network call, no process spawn, no
shell. A containment guard test fails the build if that ever changes.

### Persistence (migration 0019, local/dev; 0015 still reserved/absent)

- `fabric_nodes` — node registry: `agent_id` (ATC-backed), `label`, `platform`
  (macos|windows|linux|cloud, check-locked), `status` (active|quarantined,
  check-locked = the per-node kill switch), `capabilities` jsonb (declarative
  `{skill,tier}` array), unique (tenant, agent, label). RLS tenant-isolated.
- Receipts reuse the **Proof Registry** (no new proof kind / DB-CHECK widening):
  a simulated execution writes a `verified_fact` proof (kind `skill_demo`)
  distinguished by a `fabric-node:<id>:sim:<hash>` evidence_ref + `simulated:true`
  details. Only that verified_fact proof can later release escrow.

### Repository (twin, contract-tested on memory AND PGlite)

`insertFabricNode` / `getFabricNode` / `listFabricNodes(status?)` /
`updateFabricNodeStatus`. Contract test covers CRUD, platform/status checks,
quarantine, uniqueness, and tenant isolation on both backends.

### Service (`apps/api/src/agentFabric.ts`, simulation-only)

- `routeWorkOrder(skill, minTier)` — deterministic router: among **active** nodes
  declaring the skill at tier ≥ minTier, rank by declared tier desc → positive
  reputation desc → stable id. Quarantined nodes excluded. **Fail-closed**
  (chosen=null) when none qualify.
- `simulateExecute(node, work_order)` — produces the verified_fact receipt proof
  and **delivers** the work order via the existing economy path. Escrow is NOT
  released here; the human **owner `verify`** step still does that (invariant
  preserved).
- `setFabricNodeStatus` — quarantine/restore (kill switch).

### API (operator-authed; internal `/agent-fabric/`)

`GET /agent-fabric/nodes`, `POST /agent-fabric/nodes`, `GET /agent-fabric/route`,
`POST /agent-fabric/simulate-execute`, `POST /agent-fabric/nodes/:id/quarantine`,
`POST /agent-fabric/nodes/:id/restore`. No public route; no token/payment route.

## Invariants preserved

- Only a `verified_fact` proof releases escrow / reputation (unchanged).
- Verify + dispute stay human owner decisions; the fabric never releases value.
- Internal credits only; no real payments, no token transfers.
- Quarantine excludes a node from routing AND execution.

## Containment (LEGEND-001 guard, `packages/core/src/agentFabric.guard.test.ts`)

The service imports no `child_process` / `node:net` / `node:dgram` / `node:http`
/ `ssh2`, and makes no `spawn(` / `exec(` / `fetch(` calls. Build fails if a
future change tries to make the lab actually run remote work without a
deliberate migration + security sign-off (see the containment model doc).

## Results

- `agentFabric.test.ts` (4): register/validate; route (rank + fail-closed);
  full loop (route → simulate-execute delivers w/ verified_fact receipt → owner
  verify releases escrow + reputation); quarantine kill switch.
- `agentFabric.guard.test.ts` (4). Contract test +1 (both backends).
- Full gate: **`pnpm check` 525/525, 80 files, green** (515 + 10).

## Out of scope (still gated, design-only)

Networked nodes, Tailscale/WireGuard mesh, local/cloud model routing, real
remote execution, cross-tenant settlement, any token. Those remain in the
distributed-agent-fabric design docs behind the MVP roadmap + security sign-off.
