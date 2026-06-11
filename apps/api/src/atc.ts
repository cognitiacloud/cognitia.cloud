import { randomUUID } from 'node:crypto';
import type { Repository, AgentRow, AtcRow, AgentPermissionRow } from '@cognitia/db';
import { agentCreate, atcCreate } from '@cognitia/core';

/**
 * Agent registry + Agent Trust Credential lifecycle (COG-004). Doctrine
 * (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md §1, §4):
 *   - public name: Cognitia Agent Trust Credential (ATC); VC-style shape,
 *     no custom DID method, no cryptographic suites in v1.1;
 *   - status lifecycle is explicit: active → suspended ⇄ active,
 *     active/suspended → revoked (terminal) or expired; no delete;
 *   - claims carry scope/vertical/policy refs ONLY (strict zod — unknown
 *     keys, i.e. potential customer PII, are rejected);
 *   - every new agent starts with an explicit `sms.send_real → deny`;
 *   - every mutation writes audit_events and an immutable events row.
 */

export type AtcLifecycleAction = 'suspend' | 'resume' | 'revoke' | 'expire';

/** Legal transitions; anything else is a 409 at the API layer. */
const TRANSITIONS: Record<AtcLifecycleAction, { from: string[]; to: string }> = {
  suspend: { from: ['active'], to: 'suspended' },
  resume: { from: ['suspended'], to: 'active' },
  revoke: { from: ['active', 'suspended', 'expired'], to: 'revoked' },
  expire: { from: ['active', 'suspended'], to: 'expired' },
};

async function emitTrustAudit(
  repo: Repository,
  tenantId: string,
  actorRef: string,
  action: string,
  subjectRef: string,
  detail: Record<string, unknown>,
  traceId: string,
): Promise<void> {
  const ts = new Date().toISOString();
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action,
    subject_ref: subjectRef,
    detail,
    occurred_at: ts,
    created_at: ts,
  });
  await repo.insertEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    event_name: action,
    entity_type: subjectRef.split(':')[0] ?? 'atc',
    entity_id: subjectRef.split(':')[1] ?? subjectRef,
    source: 'api',
    occurred_at: ts,
    ingested_at: ts,
    payload: detail,
    trace_id: traceId,
    created_at: ts,
  });
}

/**
 * Register an agent. Atomically (from the caller's perspective) seeds the
 * doctrine deny: `sms.send_real → deny` exists before the agent is usable.
 */
export async function registerAgent(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<{ agent: AgentRow; permissions: AgentPermissionRow[] }> {
  const input = agentCreate.parse({ ...(body as Record<string, unknown>), tenant_id: tenantId });
  const ts = new Date().toISOString();
  const agent: AgentRow = {
    id: randomUUID(),
    tenant_id: tenantId,
    name: input.name,
    slug: input.slug,
    runtime_key: input.runtime_key ?? null,
    kind: input.kind,
    status: 'draft',
    description: input.description ?? null,
    created_at: ts,
    updated_at: ts,
  };
  await repo.createAgent(agent);
  const denyRealSms: AgentPermissionRow = {
    id: randomUUID(),
    tenant_id: tenantId,
    agent_id: agent.id,
    action_key: 'sms.send_real',
    effect: 'deny',
    constraints: {},
    created_at: ts,
    updated_at: ts,
  };
  await repo.upsertAgentPermission(denyRealSms);
  await emitTrustAudit(
    repo,
    tenantId,
    actorRef,
    'agent.registered.v1',
    `agent:${agent.id}`,
    { slug: agent.slug, kind: agent.kind },
    traceId,
  );
  return { agent, permissions: [denyRealSms] };
}

/** Issue an ATC for an agent (status starts active; claims are strict). */
export async function issueAtc(
  repo: Repository,
  tenantId: string,
  agentId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<AtcRow> {
  const agent = await repo.getAgent(tenantId, agentId);
  if (!agent) throw new AgentNotFoundError(agentId);
  const input = atcCreate.parse({
    ...(body as Record<string, unknown>),
    tenant_id: tenantId,
    agent_id: agentId,
    subject_ref: `agent:${agentId}`,
  });
  const ts = new Date().toISOString();
  const atc: AtcRow = {
    id: randomUUID(),
    tenant_id: tenantId,
    agent_id: agentId,
    issuer: input.issuer,
    subject_ref: input.subject_ref,
    claims: input.claims,
    status: 'active',
    issued_at: ts,
    expires_at: input.expires_at ?? null,
    external_ref: input.external_ref ?? null,
    version: 1,
    created_at: ts,
    updated_at: ts,
  };
  await repo.createAtc(atc);
  await emitTrustAudit(
    repo,
    tenantId,
    actorRef,
    'atc.issued.v1',
    `atc:${atc.id}`,
    { agent_id: agentId, scope: input.claims.scope },
    traceId,
  );
  return atc;
}

/** Apply a lifecycle transition. Throws on illegal transitions (409). */
export async function transitionAtc(
  repo: Repository,
  tenantId: string,
  atcId: string,
  action: AtcLifecycleAction,
  actorRef: string,
  traceId: string,
): Promise<AtcRow> {
  const atc = await repo.getAtc(tenantId, atcId);
  if (!atc) throw new AtcNotFoundError(atcId);
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(atc.status)) {
    throw new IllegalAtcTransitionError(atc.status, action);
  }
  const updated = await repo.updateAtcStatus(tenantId, atcId, rule.to);
  if (!updated) throw new AtcNotFoundError(atcId);
  await emitTrustAudit(
    repo,
    tenantId,
    actorRef,
    `atc.${action}.v1`,
    `atc:${atcId}`,
    { from: atc.status, to: rule.to },
    traceId,
  );
  return updated;
}

export class AgentNotFoundError extends Error {
  constructor(id: string) {
    super(`agent not found: ${id}`);
    this.name = 'AgentNotFoundError';
  }
}
export class AtcNotFoundError extends Error {
  constructor(id: string) {
    super(`ATC not found: ${id}`);
    this.name = 'AtcNotFoundError';
  }
}
export class IllegalAtcTransitionError extends Error {
  constructor(from: string, action: string) {
    super(`illegal ATC transition: cannot ${action} from status '${from}'`);
    this.name = 'IllegalAtcTransitionError';
  }
}
