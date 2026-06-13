import {
  idempotencyKey,
  makeEvent,
  type ActionType,
  type ActionProvenance,
  type KnownEventName,
  type RiskLevel,
  type ApprovedAgentAction,
} from '@cognitia/core';
import type { AgentActionRow, EventRow } from '@cognitia/db';
import {
  buildHubspotWritePlan,
  parseStagePlanRef,
  type AdapterResult,
  type CrmWritePlan,
} from '@cognitia/integrations';
import type { AgentDeps } from '../deps.js';
import type { GuardrailResult } from '../guardrails/index.js';
import { checkPassport, type PassportCheckResult } from './passportPolicy.js';

/** GOV-1 — what an operator sees before consenting to an execution. */
export interface ExecutionPreview {
  action_id: string;
  action_type: string;
  target_ref: string;
  risk_level: string;
  approval_status: string;
  execution_status: string;
  /** False means execute() would refuse right now (see denial_reason). */
  would_execute: boolean;
  denial_reason?: string;
  /** True when execution would be collapsed by idempotency (already executed). */
  idempotent_replay_expected: boolean;
  guardrail_results: unknown[];
  evidence_refs: string[];
  /** The exact typed CRM write (same assembly as the execution path). */
  plan: CrmWritePlan;
}

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

/** Thrown when an approve/reject arrives without a usable structured reason. */
export class InvalidDecisionError extends Error {}

/**
 * The structured "why" behind an approve/reject. Required on every decision:
 * each one is persisted as a feedback label so the approval queue doubles as
 * a labeled dataset for evals, scorecards, and future autonomy policy.
 */
export interface DecisionReason {
  reasonCode: string;
  note?: string;
}

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

  async approve(
    tenantId: string,
    actionId: string,
    approverRef: string,
    reason: DecisionReason,
  ): Promise<AgentActionRow> {
    this.requireReason(reason);
    const action = await this.requireAction(tenantId, actionId);
    await this.requireProposed(tenantId, action, approverRef, 'approve');
    const updated = await this.deps.repo.updateAgentAction(tenantId, actionId, {
      approval_status: 'approved',
    });
    await this.recordDecisionLabel(tenantId, action, 'approved', approverRef, reason);
    await this.emit(tenantId, 'mira', action.agent_run_id, 'agent.action.approved.v1', actionId, {
      approver_ref: approverRef,
      reason_code: reason.reasonCode,
    });
    await this.audit(tenantId, approverRef, 'approved', actionId, {
      reason_code: reason.reasonCode,
    });
    return updated;
  }

  async reject(
    tenantId: string,
    actionId: string,
    approverRef: string,
    reason: DecisionReason,
  ): Promise<AgentActionRow> {
    this.requireReason(reason);
    const action = await this.requireAction(tenantId, actionId);
    await this.requireProposed(tenantId, action, approverRef, 'reject');
    const updated = await this.deps.repo.updateAgentAction(tenantId, actionId, {
      approval_status: 'rejected',
    });
    await this.recordDecisionLabel(tenantId, action, 'rejected', approverRef, reason);
    await this.emit(tenantId, 'mira', action.agent_run_id, 'agent.action.rejected.v1', actionId, {
      approver_ref: approverRef,
      reason_code: reason.reasonCode,
    });
    await this.audit(tenantId, approverRef, 'rejected', actionId, {
      reason_code: reason.reasonCode,
    });
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
      // GOV-1: a refused execution is an auditable fact, not a silent 409.
      await this.audit(tenantId, 'system', 'execution_denied', actionId, {
        reason: 'not_approved',
        approval_status: action.approval_status,
      });
      await this.emit(
        tenantId,
        'mira',
        action.agent_run_id,
        'agent.action.execution_denied.v1',
        actionId,
        { reason: 'not_approved' },
      );
      throw new ExecutionError(`action ${actionId} is not approved`);
    }
    if (action.execution_status === 'executed') {
      return action; // idempotent: already done.
    }
    if (action.execution_status === 'rolled_back') {
      // A rolled-back write was deliberately undone by an operator. Its stale
      // 'approved' status must NOT allow silent re-execution — redoing the work
      // requires a fresh proposed action and a fresh approval. Fail closed,
      // audited (mirrors the not_approved denial above).
      await this.audit(tenantId, 'system', 'execution_denied', actionId, {
        reason: 'rolled_back',
      });
      await this.emit(
        tenantId,
        'mira',
        action.agent_run_id,
        'agent.action.execution_denied.v1',
        actionId,
        { reason: 'rolled_back' },
      );
      throw new ExecutionError(
        `action ${actionId} was rolled back; re-execution requires a new proposed action`,
      );
    }

    // ENF-1: the tenant kill switch is enforced here, not just documented.
    // It outranks passports: a halted tenant stays halted even for an agent
    // holding an otherwise-valid grant.
    const halt = await this.connectionHalt(tenantId, action.action_type);
    if (halt) {
      await this.audit(tenantId, 'system', 'execution_denied', actionId, { reason: halt });
      await this.emit(
        tenantId,
        'mira',
        action.agent_run_id,
        'agent.action.execution_denied.v1',
        actionId,
        { reason: halt },
      );
      throw new ExecutionError(`execution halted: ${halt}`);
    }

    // PASS-1: identity-first authorization. The acting agent must hold an
    // active passport AND a live, owner-approved scope grant covering this
    // exact (action_type, integration) at or above the action's risk tier.
    // No fallback to the bare agent name; denials are audited with the
    // passport/grant context. This is the single authz chokepoint — adapters
    // never make authorization decisions.
    const authz = await this.passportHalt(tenantId, action);
    if (!authz.allowed) {
      const detail: Record<string, unknown> = {
        reason: authz.denial,
        agent: authz.agent,
        action_type: action.action_type,
        integration: authz.integration,
        risk_level: action.risk_level,
        ...(authz.passport_id ? { passport_id: authz.passport_id } : {}),
        ...(authz.grant_id ? { grant_id: authz.grant_id } : {}),
      };
      await this.audit(tenantId, `agent:${authz.agent}`, 'execution_denied', actionId, detail);
      await this.emit(
        tenantId,
        'mira',
        action.agent_run_id,
        'agent.action.execution_denied.v1',
        actionId,
        { reason: authz.denial },
      );
      throw new ExecutionError(`execution denied: ${authz.denial}`);
    }

    await this.deps.repo.updateAgentAction(tenantId, actionId, { execution_status: 'executing' });

    // PROV-1: resolve execution lineage and hand it to the adapter so the
    // produced CRM object carries who/what produced and approved it.
    const provenance = await this.resolveProvenance(tenantId, action);

    let result: AdapterResult;
    try {
      result = await this.deps.adapters.execute(action as ApprovedAgentAction, provenance);
    } catch (err) {
      const updated = await this.deps.repo.updateAgentAction(tenantId, actionId, {
        execution_status: 'failed',
        result: { error: String(err instanceof Error ? err.message : err) },
      });
      await this.emit(tenantId, 'mira', action.agent_run_id, 'agent.action.failed.v1', actionId, {
        reason: 'adapter_error',
      });
      await this.emitCrmPushFailure(tenantId, action, actionId, 'adapter_error');
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
    if (!result.ok) {
      await this.emitCrmPushFailure(tenantId, action, actionId, 'adapter_rejected');
    }
    // CRM-2: a successful stage write-back is a first-class crm.* fact.
    if (result.ok && action.action_type === 'crm.stage.update') {
      const plan = parseStagePlanRef(action.payload_ref);
      if (plan) {
        await this.emit(
          tenantId,
          'mira',
          action.agent_run_id,
          'crm.opportunity.stage_updated.v1',
          actionId,
          { external_id: plan.externalId, from_stage: plan.fromStage, to_stage: plan.toStage },
        );
      }
    }
    await this.audit(tenantId, 'system', status, actionId, {
      idempotent_replay: result.idempotent_replay ?? false,
    });
    return updated;
  }

  /**
   * UNDO-1 — undo an executed CRM write. The adapter archives the external
   * object (HubSpot's reversible delete); the action transitions to
   * `rolled_back` with the structured reason recorded as a feedback label,
   * an immutable event, and an audit entry — so undo is as accountable as
   * execution. Idempotent: rolling back a rolled-back action returns the row.
   * Refusals (not executed / irreversible type / missing external_ref) are
   * audited as `rollback_denied`, mirroring GOV-1's audited denials.
   */
  async rollback(
    tenantId: string,
    actionId: string,
    approverRef: string,
    reason: DecisionReason,
  ): Promise<AgentActionRow> {
    this.requireReason(reason);
    const action = await this.requireAction(tenantId, actionId);
    if (action.execution_status === 'rolled_back') {
      return action; // idempotent: already undone.
    }
    const denied = async (why: string): Promise<never> => {
      await this.audit(tenantId, approverRef, 'rollback_denied', actionId, { reason: why });
      throw new ExecutionError(`rollback refused: ${why}`);
    };
    if (action.execution_status !== 'executed') {
      await denied(`action is ${action.execution_status}, not executed`);
    }
    const externalRef = (action.result as { external_ref?: string } | null)?.external_ref;
    if (!externalRef) {
      await denied('no external_ref recorded on the executed result');
    }
    // ENF-1: rollback is also an external write — the kill switch gates it too.
    const halt = await this.connectionHalt(tenantId, action.action_type);
    if (halt) {
      await denied(`halted: ${halt}`);
    }

    const result = await this.deps.adapters.rollback(action.action_type, tenantId, externalRef!);
    if (!result.ok) {
      await denied(result.detail ?? 'adapter refused rollback');
    }

    const updated = await this.deps.repo.updateAgentAction(tenantId, actionId, {
      execution_status: 'rolled_back',
      result: {
        ...(action.result as Record<string, unknown>),
        rolled_back: true,
        rollback_reason_code: reason.reasonCode,
      },
    });
    await this.recordDecisionLabel(tenantId, action, 'rolled_back', approverRef, reason);
    await this.emit(
      tenantId,
      'mira',
      action.agent_run_id,
      'agent.action.rolled_back.v1',
      actionId,
      { external_ref: externalRef!, reason_code: reason.reasonCode },
    );
    await this.audit(tenantId, approverRef, 'rolled_back', actionId, {
      external_ref: externalRef!,
      reason_code: reason.reasonCode,
    });
    return updated;
  }

  /**
   * GOV-1 — typed execution preview: the EXACT CRM write this action will
   * perform, plus the deterministic policy facts an operator needs before
   * consenting. The plan is built by the same pure assembly the execution
   * path uses, so the preview cannot drift from the write. Note: before
   * approval, `cognitia_approved_by` is absent from the plan (it resolves
   * from the approval label); every other property is final.
   */
  async previewExecution(tenantId: string, actionId: string): Promise<ExecutionPreview> {
    const action = await this.requireAction(tenantId, actionId);
    const provenance = await this.resolveProvenance(tenantId, action);
    const plan = buildHubspotWritePlan(action, provenance);
    const approved = action.approval_status === 'approved';
    return {
      action_id: action.id,
      action_type: action.action_type,
      target_ref: action.target_ref,
      risk_level: action.risk_level,
      approval_status: action.approval_status,
      execution_status: action.execution_status,
      would_execute: approved,
      ...(approved ? {} : { denial_reason: 'not_approved' }),
      idempotent_replay_expected: action.execution_status === 'executed',
      guardrail_results: action.guardrail_results,
      evidence_refs: action.evidence_refs,
      plan,
    };
  }

  /**
   * Decision state machine: only a `proposed` action can be approved or
   * rejected. Without this, a rejected action could be silently flipped to
   * approved (reversing a deliberate denial), and repeat decisions would write
   * duplicate feedback labels that corrupt scorecards and provenance (which
   * resolves the approver from the first 'approved' label). A refused decision
   * is an auditable fact, mirroring GOV-1's audited execution denials.
   */
  private async requireProposed(
    tenantId: string,
    action: AgentActionRow,
    actorRef: string,
    attempted: 'approve' | 'reject',
  ): Promise<void> {
    if (action.approval_status === 'proposed') return;
    await this.audit(tenantId, actorRef, 'decision_denied', action.id, {
      attempted,
      reason: 'already_decided',
      approval_status: action.approval_status,
    });
    throw new InvalidDecisionError(
      `cannot ${attempted}: action is already ${action.approval_status} (decisions are immutable; propose a new action instead)`,
    );
  }

  /** Backstop for non-API callers; the API validates codes against the enums. */
  private requireReason(reason: DecisionReason | undefined): void {
    if (!reason || typeof reason.reasonCode !== 'string' || reason.reasonCode.trim() === '') {
      throw new InvalidDecisionError('a structured decision reason (reasonCode) is required');
    }
  }

  /**
   * Persist the decision as a feedback label. The detail snapshot is
   * self-contained (action type / risk / target ref alongside the reason) so
   * evals and scorecards can segment labels without joining back to actions.
   */
  private async recordDecisionLabel(
    tenantId: string,
    action: AgentActionRow,
    label: 'approved' | 'rejected' | 'rolled_back',
    approverRef: string,
    reason: DecisionReason,
  ): Promise<void> {
    const ts = this.deps.now().toISOString();
    await this.deps.repo.insertFeedbackLabel({
      id: this.deps.newId(),
      tenant_id: tenantId,
      subject_ref: `agent_action:${action.id}`,
      label,
      detail: {
        reason_code: reason.reasonCode,
        note: reason.note ?? null,
        approver_ref: approverRef,
        action_type: action.action_type,
        risk_level: action.risk_level,
        target_ref: action.target_ref,
      },
      created_at: ts,
      updated_at: ts,
    });
  }

  /**
   * ENF-1 — tenant kill switch. Resolves the integration system behind an
   * action type via the adapter registry and checks the tenant's connection
   * row: any non-'active' status ('paused', 'error', 'revoked') halts external
   * writes for that tenant, no redeploy needed. A missing row does not gate —
   * dev/test compositions run without connection rows; production always has
   * one (created at onboarding). Returns the halt reason, or null to proceed.
   */
  private async connectionHalt(tenantId: string, actionType: string): Promise<string | null> {
    const adapter = this.deps.adapters.find(actionType);
    if (!adapter) return null; // no adapter → execute() will refuse downstream anyway
    const conn = await this.deps.repo.getIntegrationConnection(tenantId, adapter.system);
    if (!conn) return null;
    return conn.status === 'active' ? null : `connection_${conn.status}`;
  }

  /**
   * PASS-1 — resolve the acting agent (from its run) to a passport + grants
   * and apply the pure policy. Fail closed: a missing run means the actor
   * cannot be identified, which is a passport_missing denial, never a pass.
   * When the action type has no adapter, there is no integration to scope to
   * and execute() refuses downstream — the policy is not consulted.
   */
  private async passportHalt(
    tenantId: string,
    action: AgentActionRow,
  ): Promise<PassportCheckResult & { agent: string; integration: string }> {
    const adapter = this.deps.adapters.find(action.action_type);
    if (!adapter) return { allowed: true, agent: '', integration: '' }; // no adapter → refused downstream
    const run = await this.deps.repo.getAgentRun(tenantId, action.agent_run_id);
    const agent = run?.agent ?? 'unknown';
    const passport = run ? await this.deps.repo.findAgentPassportByAgent(tenantId, agent) : null;
    const grants = passport ? await this.deps.repo.listScopeGrants(tenantId, passport.id) : [];
    const result = checkPassport({
      passport,
      grants,
      actionType: action.action_type,
      integration: adapter.system,
      riskLevel: action.risk_level,
      now: this.deps.now(),
    });
    return { ...result, agent, integration: adapter.system };
  }

  private async requireAction(tenantId: string, actionId: string): Promise<AgentActionRow> {
    const action = await this.deps.repo.getAgentAction(tenantId, actionId);
    if (!action) throw new ExecutionError(`action ${actionId} not found for tenant`);
    return action;
  }

  /**
   * Assemble execution lineage for an approved action: agent from its run, the
   * approver from the FLY-1 approval label, evidence/risk from the action.
   * Best-effort — provenance is supplementary, so a missing run/label degrades
   * gracefully (agent falls back to "mira", approver is simply omitted) and
   * never blocks execution.
   */
  private async resolveProvenance(
    tenantId: string,
    action: AgentActionRow,
  ): Promise<ActionProvenance> {
    const run = await this.deps.repo.getAgentRun(tenantId, action.agent_run_id);
    const labels = await this.deps.repo.listFeedbackLabels(tenantId, `agent_action:${action.id}`);
    const approval = labels.find((l) => l.label === 'approved');
    const approvedBy = approval ? str(approval.detail['approver_ref']) : undefined;
    return {
      agent: run?.agent ?? 'mira',
      agent_run_id: action.agent_run_id,
      agent_action_id: action.id,
      evidence_count: action.evidence_refs.length,
      risk_level: action.risk_level as ActionProvenance['risk_level'],
      ...(approvedBy ? { approved_by: approvedBy } : {}),
    };
  }

  /**
   * CRM-2: a failed CRM write-back additionally emits `crm.push.failed.v1`
   * (alongside the generic agent.action.failed.v1) so CRM-push health is
   * directly observable on the events stream / ops overview.
   */
  private async emitCrmPushFailure(
    tenantId: string,
    action: { action_type: string; agent_run_id: string },
    actionId: string,
    reason: string,
  ): Promise<void> {
    if (!action.action_type.startsWith('crm.')) return;
    await this.emit(tenantId, 'mira', action.agent_run_id, 'crm.push.failed.v1', actionId, {
      action_type: action.action_type,
      reason,
    });
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

/** Narrow an unknown jsonb value to a non-empty string, else undefined. */
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
