import {
  idempotencyKey,
  makeEvent,
  type ActionType,
  type KnownEventName,
  type RiskLevel,
  type ApprovedAgentAction,
} from '@cognitia/core';
import type { AgentActionRow, EventRow } from '@cognitia/db';
import type { AdapterResult } from '@cognitia/integrations';
import type { AgentDeps } from '../deps.js';
import type { GuardrailResult } from '../guardrails/index.js';

export interface ProposeInput {
  tenantId: string;
  agentRunId: string;
  agent: string;
  traceId: string;
  actionType: ActionType;
  riskLevel: RiskLevel;
  targetRef: string;
  evidenceRefs: string[];
  contentFingerprint: string;
  payloadRef?: string;
  guardrailResults: GuardrailResult[];
}

export class ExecutionError extends Error {}

/**
 * Creates, approves/rejects, and executes agent_actions — the single chokepoint
 * for side effects. Enforces idempotency (unique tenant_id+idempotency_key) and
 * the rule that nothing executes without an approved, ledgered action. Every
 * transition emits an immutable event + audit entry.
 */
export class ActionLedger {
  constructor(private readonly deps: AgentDeps) {}

  /** Create a proposed action. Replays (same idempotency_key) return the prior row. */
  async propose(input: ProposeInput): Promise<AgentActionRow> {
    const key = idempotencyKey({
      tenant_id: input.tenantId,
      action_type: input.actionType,
      target_ref: input.targetRef,
      content_fingerprint: input.contentFingerprint,
    });
    const existing = await this.deps.repo.findActionByIdempotencyKey(input.tenantId, key);
    if (existing) return existing;

    const ts = this.deps.now().toISOString();
    const action: AgentActionRow = {
      id: this.deps.newId(),
      tenant_id: input.tenantId,
      agent_run_id: input.agentRunId,
      action_type: input.actionType,
      risk_level: input.riskLevel,
      idempotency_key: key,
      approval_status: 'proposed',
      execution_status: 'pending',
      target_ref: input.targetRef,
      evidence_refs: input.evidenceRefs,
      payload_ref: input.payloadRef ?? null,
      guardrail_results: input.guardrailResults,
      result: null,
      created_at: ts,
      updated_at: ts,
    };
    const created = await this.deps.repo.createAgentAction(action);
    await this.emit(
      input.tenantId,
      input.agent,
      input.traceId,
      'agent.action.proposed.v1',
      created.id,
      {
        action_type: created.action_type,
        risk_level: created.risk_level,
        evidence_refs: created.evidence_refs,
      },
    );
    await this.audit(input.tenantId, `agent:${input.agent}`, 'proposed', created.id);
    return created;
  }

  async approve(tenantId: string, actionId: string, approverRef: string): Promise<AgentActionRow> {
    const action = await this.requireAction(tenantId, actionId);
    const updated = await this.deps.repo.updateAgentAction(tenantId, actionId, {
      approval_status: 'approved',
    });
    await this.emit(tenantId, 'mira', action.agent_run_id, 'agent.action.approved.v1', actionId, {
      approver_ref: approverRef,
    });
    await this.audit(tenantId, approverRef, 'approved', actionId);
    return updated;
  }

  async reject(
    tenantId: string,
    actionId: string,
    approverRef: string,
    reason?: string,
  ): Promise<AgentActionRow> {
    const action = await this.requireAction(tenantId, actionId);
    const updated = await this.deps.repo.updateAgentAction(tenantId, actionId, {
      approval_status: 'rejected',
    });
    await this.emit(tenantId, 'mira', action.agent_run_id, 'agent.action.rejected.v1', actionId, {
      approver_ref: approverRef,
      reason: reason ?? '',
    });
    await this.audit(tenantId, approverRef, 'rejected', actionId, { reason });
    return updated;
  }

  /**
   * Execute an approved action via the adapter registry. Idempotent at two
   * layers: (1) if already executed, returns the stored result without
   * re-dispatching; (2) the adapter dedupes on idempotency_key. Refuses to
   * execute anything not approved.
   */
  async execute(tenantId: string, actionId: string): Promise<AgentActionRow> {
    const action = await this.requireAction(tenantId, actionId);

    if (action.approval_status !== 'approved') {
      throw new ExecutionError(`action ${actionId} is not approved`);
    }
    if (action.execution_status === 'executed') {
      return action; // idempotent: already done.
    }

    await this.deps.repo.updateAgentAction(tenantId, actionId, { execution_status: 'executing' });

    let result: AdapterResult;
    try {
      result = await this.deps.adapters.execute(action as ApprovedAgentAction);
    } catch (err) {
      const updated = await this.deps.repo.updateAgentAction(tenantId, actionId, {
        execution_status: 'failed',
        result: { error: String(err instanceof Error ? err.message : err) },
      });
      await this.emit(tenantId, 'mira', action.agent_run_id, 'agent.action.failed.v1', actionId, {
        reason: 'adapter_error',
      });
      await this.audit(tenantId, 'system', 'failed', actionId);
      return updated;
    }

    const status = result.ok ? 'executed' : 'failed';
    const updated = await this.deps.repo.updateAgentAction(tenantId, actionId, {
      execution_status: status,
      result: { ...result },
    });
    const eventName: KnownEventName = result.ok
      ? 'agent.action.executed.v1'
      : 'agent.action.failed.v1';
    await this.emit(
      tenantId,
      'mira',
      action.agent_run_id,
      eventName,
      actionId,
      result.ok ? { idempotency_key: action.idempotency_key } : { reason: 'adapter_rejected' },
    );
    await this.audit(tenantId, 'system', status, actionId, {
      idempotent_replay: result.idempotent_replay ?? false,
    });
    return updated;
  }

  private async requireAction(tenantId: string, actionId: string): Promise<AgentActionRow> {
    const action = await this.deps.repo.getAgentAction(tenantId, actionId);
    if (!action) throw new ExecutionError(`action ${actionId} not found for tenant`);
    return action;
  }

  private async emit(
    tenantId: string,
    agent: string,
    traceId: string,
    eventName: KnownEventName,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event = makeEvent(
      {
        tenant_id: tenantId,
        event_name: eventName,
        entity_type: 'agent_action',
        entity_id: entityId,
        source: `agent:${agent}`,
        payload,
        trace_id: traceId,
      },
      this.deps.now,
      this.deps.newId,
    ) as EventRow;
    await this.deps.repo.insertEvent(event);
  }

  private async audit(
    tenantId: string,
    actorRef: string,
    action: string,
    subjectId: string,
    detail: Record<string, unknown> = {},
  ): Promise<void> {
    const ts = this.deps.now().toISOString();
    await this.deps.repo.insertAuditEvent({
      id: this.deps.newId(),
      tenant_id: tenantId,
      actor_ref: actorRef,
      action,
      subject_ref: `agent_action:${subjectId}`,
      detail,
      occurred_at: ts,
      created_at: ts,
    });
  }
}
