import { randomUUID, createHash } from 'node:crypto';
import type { Repository, FabricNodeRow } from '@cognitia/db';
import { createProof } from './proofs.js';
import { deliverWorkOrder, getWorkOrderView, type WorkOrderView } from './agentEconomy.js';

/**
 * LEGEND-001 — Agent Fabric Lab service.
 *
 * SIMULATION ONLY. This module routes agent work to a registered "node" and
 * records a SIMULATED execution receipt as a verified_fact Proof, then delivers
 * the work order through the EXISTING Agent Economy path. It NEVER performs
 * remote execution: there is no network call, no process spawn, no shell — the
 * "execution" is a pure, deterministic function over in-process data. Real
 * distributed execution is a deliberate, gated future step (see the
 * distributed-agent-fabric design docs + containment model).
 *
 * Invariants preserved: only a verified_fact proof can later release escrow /
 * reputation (the human `verify` step does that, unchanged); a quarantined node
 * takes no new routing or execution (the per-node kill switch).
 */

export class FabricNodeNotFoundError extends Error {
  constructor(id: string) {
    super(`fabric node not found: ${id}`);
  }
}
export class FabricNodeQuarantinedError extends Error {
  constructor(id: string) {
    super(`fabric node is quarantined: ${id}`);
  }
}
export class FabricValidationError extends Error {}
export class FabricAgentNotFoundError extends Error {
  constructor(id: string) {
    super(`agent not found for fabric node: ${id}`);
  }
}
export class NoEligibleFabricNodeError extends Error {
  constructor(skill: string, minTier: number) {
    super(`no eligible, active fabric node for skill "${skill}" at tier >= ${minTier}`);
  }
}

export interface NodeCapability {
  skill: string;
  tier: number;
}
const PLATFORMS = ['macos', 'windows', 'linux', 'cloud'];

/** Defensive parse of the jsonb capabilities column into a typed array. */
export function parseCapabilities(raw: unknown): NodeCapability[] {
  if (!Array.isArray(raw)) return [];
  const out: NodeCapability[] = [];
  for (const c of raw) {
    if (c && typeof c === 'object') {
      const skill = (c as Record<string, unknown>).skill;
      const tier = (c as Record<string, unknown>).tier;
      if (typeof skill === 'string' && typeof tier === 'number' && Number.isFinite(tier)) {
        out.push({ skill, tier });
      }
    }
  }
  return out;
}

export interface RegisterNodeInput {
  agent_id: string;
  label: string;
  platform: string;
  capabilities?: NodeCapability[];
}

function parseRegisterInput(body: unknown): RegisterNodeInput {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.agent_id !== 'string' || b.agent_id.length === 0) {
    throw new FabricValidationError('agent_id is required');
  }
  if (typeof b.label !== 'string' || b.label.trim().length === 0) {
    throw new FabricValidationError('label is required');
  }
  if (typeof b.platform !== 'string' || !PLATFORMS.includes(b.platform)) {
    throw new FabricValidationError(`platform must be one of ${PLATFORMS.join(', ')}`);
  }
  const capabilities = b.capabilities === undefined ? [] : parseCapabilities(b.capabilities);
  return { agent_id: b.agent_id, label: b.label.trim(), platform: b.platform, capabilities };
}

export async function registerFabricNode(
  repo: Repository,
  tenantId: string,
  body: unknown,
): Promise<FabricNodeRow> {
  const input = parseRegisterInput(body);
  const agent = await repo.getAgent(tenantId, input.agent_id);
  if (!agent) throw new FabricAgentNotFoundError(input.agent_id);
  const now = new Date().toISOString();
  return repo.insertFabricNode({
    id: randomUUID(),
    tenant_id: tenantId,
    agent_id: input.agent_id,
    label: input.label,
    platform: input.platform,
    status: 'active',
    capabilities: input.capabilities ?? [],
    created_at: now,
    updated_at: now,
  });
}

export async function listFabricNodes(
  repo: Repository,
  tenantId: string,
  status?: string,
): Promise<FabricNodeRow[]> {
  return repo.listFabricNodes(tenantId, status);
}

/** Positive-reputation count for an agent (the only ranking signal that uses value). */
async function positiveReputation(
  repo: Repository,
  tenantId: string,
  agentId: string,
): Promise<number> {
  const events = await repo.listReputationEvents(tenantId, agentId);
  return events.filter((e) => Number(e.delta) > 0).length;
}

export interface RouteCandidate {
  node_id: string;
  label: string;
  platform: string;
  declared_tier: number;
  positive_reputation: number;
  eligible: boolean;
  reason: string;
}
export interface RouteDecision {
  skill: string;
  min_tier: number;
  chosen: RouteCandidate | null;
  candidates: RouteCandidate[];
}

/**
 * Deterministic router: among ACTIVE nodes that declare the skill at tier >=
 * minTier, rank by declared tier desc, then positive reputation desc, then
 * oldest-first (stable). Quarantined nodes are excluded. Fail-closed.
 */
export async function routeWorkOrder(
  repo: Repository,
  tenantId: string,
  skill: string,
  minTier = 0,
): Promise<RouteDecision> {
  if (typeof skill !== 'string' || skill.length === 0) {
    throw new FabricValidationError('skill is required');
  }
  const nodes = await repo.listFabricNodes(tenantId);
  const candidates: RouteCandidate[] = [];
  for (const n of nodes) {
    const caps = parseCapabilities(n.capabilities);
    const match = caps.filter((c) => c.skill === skill).sort((a, b) => b.tier - a.tier)[0];
    const declaredTier = match?.tier ?? -1;
    const active = n.status === 'active';
    const meetsTier = declaredTier >= minTier;
    const eligible = active && !!match && meetsTier;
    const reason = !match
      ? 'skill not declared'
      : !active
        ? `node ${n.status}`
        : !meetsTier
          ? `declared tier ${declaredTier} < ${minTier}`
          : 'eligible';
    candidates.push({
      node_id: n.id,
      label: n.label,
      platform: n.platform,
      declared_tier: declaredTier,
      positive_reputation: await positiveReputation(repo, tenantId, n.agent_id),
      eligible,
      reason,
    });
  }
  const ranked = candidates
    .filter((c) => c.eligible)
    .sort(
      (a, b) =>
        b.declared_tier - a.declared_tier ||
        b.positive_reputation - a.positive_reputation ||
        a.node_id.localeCompare(b.node_id),
    );
  return { skill, min_tier: minTier, chosen: ranked[0] ?? null, candidates };
}

export interface SimulateExecuteResult {
  node_id: string;
  proof_id: string;
  work_order: WorkOrderView;
}

/**
 * Simulate execution of a work order on a node and record a verified_fact
 * RECEIPT proof, then deliver the work order via the existing economy path.
 * Escrow is NOT released here — a human `verify` step still does that.
 */
export async function simulateExecute(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<SimulateExecuteResult> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.node_id !== 'string') throw new FabricValidationError('node_id is required');
  if (typeof b.work_order_id !== 'string')
    throw new FabricValidationError('work_order_id is required');
  const node = await repo.getFabricNode(tenantId, b.node_id);
  if (!node) throw new FabricNodeNotFoundError(b.node_id);
  if (node.status !== 'active') throw new FabricNodeQuarantinedError(node.id);

  // Deterministic, in-process "execution": a hash of the inputs. No network,
  // no process spawn, no remote command — this is a simulation receipt only.
  const receipt = createHash('sha256')
    .update(`${node.id}:${b.work_order_id}:${node.agent_id}`)
    .digest('hex')
    .slice(0, 16);

  const proof = await createProof(
    repo,
    tenantId,
    {
      // Reuses the existing proof 'skill_demo' kind (the simulated-execution
      // kind, as in the Economy Lab); a fabric receipt is distinguished by its
      // `fabric-node:` evidence_ref + details_private. No new proof kind / DB
      // CHECK widening is introduced.
      kind: 'skill_demo',
      subject_type: 'work_order',
      subject_id: b.work_order_id,
      evidence_tag: 'verified_fact',
      evidence_ref: `fabric-node:${node.id}:sim:${receipt}`,
      verifier_ref: 'verifier:fabric-lab',
      summary_public: 'Simulated agent-fabric execution receipt (Agent Fabric Lab).',
      details_private: {
        node_id: node.id,
        node_label: node.label,
        platform: node.platform,
        work_order_id: b.work_order_id,
        simulated: true,
      },
    },
    actorRef,
    traceId,
  );

  // Deliver through the existing economy path with our receipt proof. Verify
  // (escrow release + reputation) remains a separate, human step.
  const view = await deliverWorkOrder(
    repo,
    tenantId,
    b.work_order_id,
    {
      proof_id: proof.id,
      outcome_type: typeof b.outcome_type === 'string' ? b.outcome_type : undefined,
    },
    actorRef,
    traceId,
  );
  return { node_id: node.id, proof_id: proof.id, work_order: view };
}

export async function setFabricNodeStatus(
  repo: Repository,
  tenantId: string,
  id: string,
  status: 'active' | 'quarantined',
): Promise<FabricNodeRow> {
  const updated = await repo.updateFabricNodeStatus(tenantId, id, status);
  if (!updated) throw new FabricNodeNotFoundError(id);
  return updated;
}

export async function buildFabricView(repo: Repository, tenantId: string) {
  const nodes = await repo.listFabricNodes(tenantId);
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      agent_id: n.agent_id,
      label: n.label,
      platform: n.platform,
      status: n.status,
      capabilities: parseCapabilities(n.capabilities),
    })),
    active: nodes.filter((n) => n.status === 'active').length,
    quarantined: nodes.filter((n) => n.status === 'quarantined').length,
    note: 'Simulation-only lab. Nodes are registry metadata; the fabric executes nothing for real.',
  };
}

/** Re-export the WorkOrderView shape so handlers can be precise. */
export type { WorkOrderView };

/** getWorkOrderView is reused by tests/handlers wanting the post-verify state. */
export { getWorkOrderView };
