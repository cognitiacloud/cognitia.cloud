import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { verifyAuditChain, type Repository } from '@cognitia/db';
import type { GtmServices } from '@cognitia/agents';
import { ExecutionError, InvalidDecisionError } from '@cognitia/agents';
import {
  verifyHubspotSignatureV3,
  checkHubspotReadiness,
  type HubspotClient,
} from '@cognitia/integrations';
import { approveDecision, rejectDecision, log } from '@cognitia/core';
import {
  buildContactAuditExport,
  buildRetentionStatus,
  ContactNotFoundError,
} from './auditExport.js';
import { buildOpsOverview } from './opsOverview.js';
import { runStageReview } from './stageReview.js';
import { buildDsarExport, eraseContactData, DsarContactNotFoundError } from './dsar.js';
import { buildAccessReview } from './accessReview.js';
import {
  anchorAuditChain,
  verifyAgainstLatestAnchor,
  InMemoryAnchorSink,
  type AnchorSink,
} from './anchoring.js';
import type { SsoConfigStore } from './sso.js';
import { MUTATING_ROLES, type Role } from './auth.js';
import { computeTrustMetrics } from './trustMetrics.js';
import { runPreflight } from './preflight.js';
import { buildTrustPacket } from './trustPacket.js';
import { buildGovernanceMatrix } from './governance.js';
import { buildRegressionScenario } from '@cognitia/evals';
import { buildActionRationale } from './rationale.js';
import { computeScorecards } from './scorecards.js';
import { buildRunPlans } from './runPlans.js';

/**
 * Framework-agnostic request/response so handlers are unit-testable without a
 * running HTTP server. The Fastify binding (server.ts) adapts to these.
 *
 * NOTE: `tenantId`/`role` are the RESOLVED principal set by the server from a
 * verified session — never read from a client header on operator routes.
 */
export interface ApiRequest {
  tenantId?: string;
  /** Resolved role from the verified session principal (RBAC). */
  role?: Role;
  /** Resolved user identity from the verified session principal — used as the
   * audit actor so decisions attribute to a person, not just a role. */
  userRef?: string;
  params?: Record<string, string>;
  query?: Record<string, string | undefined>;
  body?: unknown;
  traceId?: string;
  /** Lowercased request headers (signed-webhook verification). */
  headers?: Record<string, string | undefined>;
  /** HTTP method (signed-webhook verification). */
  method?: string;
  /** Full request URI incl. scheme+host+path+query — exactly what HubSpot signs. */
  fullUri?: string;
  /** Exact raw request body bytes/string — required for signature verification. */
  rawBody?: string;
}
export interface ApiResponse {
  status: number;
  body: unknown;
}

/** Handler configuration (secrets injected, never hard-coded). */
export interface ApiHandlersConfig {
  /** HubSpot app client secret used for webhook v3 signature verification. */
  hubspotWebhookSecret?: string;
  /** Injectable clock for signature replay-window checks (tests). */
  now?: () => number;
  /** DB connectivity probe for `/health` (returns true when reachable). */
  healthCheck?: () => Promise<boolean>;
  /** HubSpot client for read-only readiness checks (RDY-1); absent in dev. */
  hubspotClient?: HubspotClient;
  /** AUTH-2: tenant SSO config store (for access-review export). Absent in dev. */
  ssoConfigStore?: SsoConfigStore;
  /**
   * Audit-chain anchor sink (external, append-only in prod). Defaults to an
   * in-memory sink — MECHANISM ONLY, not durable/independent; production injects
   * a real external sink.
   */
  anchorSink?: AnchorSink;
}

const miraRunBody = z.object({
  objective: z.string().min(1).default('build outbound pipeline'),
  icp: z
    .object({
      industries: z.array(z.string()).optional(),
      minEmployees: z.number().optional(),
      maxEmployees: z.number().optional(),
      regions: z.array(z.string()).optional(),
    })
    .optional(),
  playbookRef: z.string().optional(),
  maxAccounts: z.number().int().positive().optional(),
});

/**
 * Approve/reject require a structured reason (FLY-1 decision flywheel): the
 * code must come from the closed enums in @cognitia/core, with an optional
 * free-text note (mandatory when the code is `other`). 400 if missing/invalid.
 */
const approveBody = z.object({ reason: approveDecision });
const rejectBody = z.object({ reason: rejectDecision });

/**
 * Batch decision (UX-2): a non-empty, de-dupable id list plus one shared
 * structured reason. The reason accepts either an approve or reject code — the
 * specific endpoint (batchApprove/batchReject) determines which path runs, and
 * the per-id ledger call re-validates. Capped to keep a batch a single UI action.
 */
const batchDecisionBody = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  reason: z.object({
    reason_code: z.string().min(1),
    note: z.string().max(2000).optional(),
  }),
});

/** PASS-1: passport issuance + grant approval bodies (owner-only paths). */
const passportBody = z.object({
  agent_id: z.string().min(1),
  key_ref: z.string().min(1).optional(),
});
const grantBody = z.object({
  action_type: z.string().min(1),
  integration: z.string().min(1),
  risk_max: z.enum(['none', 'low', 'medium', 'high']),
  // Grants always expire; an open-ended grant is not issuable.
  expires_at: z.string().datetime(),
});

const hubspotContactWebhook = z.object({
  externalId: z.string().min(1),
  fullName: z.string().optional(),
  title: z.string().optional(),
  // PII-safe: callers send a hash, never a raw email.
  emailHash: z.string().optional(),
});

/** Tenant from the resolved (session-derived) principal. */
function requireTenant(req: ApiRequest): string {
  if (!req.tenantId) {
    throw new HttpError(401, 'unauthenticated');
  }
  return req.tenantId;
}

/** RBAC gate for side-effecting endpoints (run/approve/reject/execute). */
function requireMutatingRole(req: ApiRequest): string {
  const tenantId = requireTenant(req);
  if (!req.role || !MUTATING_ROLES.has(req.role)) {
    throw new HttpError(403, 'forbidden: requires operator or owner role');
  }
  return tenantId;
}

/**
 * ENF-1 — owner-only gate. Deliberately asymmetric with the kill switch:
 * any operator may PAUSE (pulling the cord must be cheap), but only the
 * owner may RESUME (recovery is a deliberate decision).
 */
function requireOwner(req: ApiRequest): string {
  const tenantId = requireTenant(req);
  if (req.role !== 'owner') {
    throw new HttpError(403, 'forbidden: requires owner role');
  }
  return tenantId;
}

/**
 * Audit actor for a request: the verified user identity when present (the
 * production path always has it — sendAuthed threads principal.userRef), with
 * the role as fallback for direct-handler callers. Attribution to a person,
 * not just a role, is what makes the audit trail accountable.
 */
function actorRef(req: ApiRequest): string {
  return `user:${req.userRef ?? req.role ?? 'unknown'}`;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * All HTTP handlers for the API. Each returns an ApiResponse. Endpoints that are
 * not part of the Mira MVP are stubbed with explicit 501s or empty payloads so
 * the surface is complete and discoverable.
 */
export class ApiHandlers {
  /** Audit-chain anchor sink: injected external sink in prod, else in-memory. */
  private readonly anchorSink: AnchorSink;

  constructor(
    private readonly repo: Repository,
    private readonly services: GtmServices,
    private readonly config: ApiHandlersConfig = {},
  ) {
    this.anchorSink = this.config.anchorSink ?? new InMemoryAnchorSink();
  }

  async health(): Promise<ApiResponse> {
    const dbUp = this.config.healthCheck
      ? await this.config.healthCheck().catch(() => false)
      : true;
    return dbUp
      ? { status: 200, body: { status: 'ok', service: 'cognitia-api', db: 'up' } }
      : { status: 503, body: { status: 'degraded', service: 'cognitia-api', db: 'down' } };
  }

  // --- Mira ---
  async runMira(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const parsed = miraRunBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: parsed.error.message } };
    }
    const result = await this.services.mira.run({
      tenantId,
      objective: parsed.data.objective,
      traceId: req.traceId ?? `trace-${Date.now()}`,
      icp: parsed.data.icp,
      playbookRef: parsed.data.playbookRef,
      maxAccounts: parsed.data.maxAccounts,
    });
    return { status: 201, body: result };
  }

  /**
   * SIM-1 — preflight simulation: the real runtime over an ephemeral copy of
   * the tenant's data. Persists nothing; reports exactly what a live run
   * would propose, with the GOV-1 write plan per proposal. Same role as
   * runMira (it triggers agent compute), but zero side effects.
   */
  async preflightMira(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const parsed = miraRunBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: parsed.error.message } };
    }
    const report = await runPreflight(this.repo, tenantId, {
      objective: parsed.data.objective,
      icp: parsed.data.icp,
      maxAccounts: parsed.data.maxAccounts,
    });
    return { status: 200, body: report };
  }

  /**
   * RUN-1 — run/plan list (read-only; viewer-allowed). Each run with a
   * governance rollup of its proposed actions — the operator's unit of work.
   */
  async listRunPlans(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const [runs, actions] = await Promise.all([
      this.repo.listAgentRuns(tenantId),
      this.repo.listAgentActions(tenantId),
    ]);
    return { status: 200, body: { runs: buildRunPlans(runs, actions) } };
  }

  /**
   * RUN-2 — run detail/timeline (read-only; viewer-allowed). Returns the run
   * plus its proposed actions in created order (the lineage an operator reviews)
   * and the same governance rollup the run list shows. Read-only; reuses the
   * ledger — no new write paths.
   */
  async getAgentRun(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    const run = await this.repo.getAgentRun(tenantId, id);
    if (!run) return { status: 404, body: { error: 'agent_run not found' } };
    const actions = (await this.repo.listAgentActions(tenantId)).filter(
      (a) => a.agent_run_id === id,
    );
    const timeline = [...actions].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const [plan] = buildRunPlans([run], actions);
    return { status: 200, body: { run, rollup: plan!.rollup, actions: timeline } };
  }

  // --- Agent actions / approval queue ---
  async listAgentActions(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const status = req.query?.status;
    const actions = await this.repo.listAgentActions(tenantId, {
      approvalStatus: status,
    });
    // Embed draft content for email actions so the approval UI can render it.
    const withDrafts = await Promise.all(
      actions.map(async (a) => ({
        ...a,
        draft: a.payload_ref ? await this.services.draftStore.get(a.payload_ref) : null,
      })),
    );
    return { status: 200, body: { actions: withDrafts } };
  }

  async approveAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const id = req.params?.id ?? '';
    const parsed = approveBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: 'a structured reason is required to approve' } };
    }
    try {
      const action = await this.services.ledger.approve(tenantId, id, actorRef(req), {
        reasonCode: parsed.data.reason.reason_code,
        note: parsed.data.reason.note,
      });
      return { status: 200, body: action };
    } catch (err) {
      return this.ledgerError(err);
    }
  }

  async rejectAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const id = req.params?.id ?? '';
    const parsed = rejectBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: 'a structured reason is required to reject' } };
    }
    try {
      const action = await this.services.ledger.reject(tenantId, id, actorRef(req), {
        reasonCode: parsed.data.reason.reason_code,
        note: parsed.data.reason.note,
      });
      return { status: 200, body: action };
    } catch (err) {
      return this.ledgerError(err);
    }
  }

  /**
   * UNDO-1 — undo an executed CRM write. Requires a structured reason (the
   * reject taxonomy: why is this write being undone?); refusals are 409 and
   * audited as rollback_denied by the ledger.
   */
  async rollbackAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const id = req.params?.id ?? '';
    const parsed = rejectBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: 'a structured reason is required to roll back' } };
    }
    try {
      const action = await this.services.ledger.rollback(tenantId, id, actorRef(req), {
        reasonCode: parsed.data.reason.reason_code,
        note: parsed.data.reason.note,
      });
      return { status: 200, body: action };
    } catch (err) {
      if (err instanceof ExecutionError) {
        return { status: 409, body: { error: err.message } };
      }
      return this.ledgerError(err);
    }
  }

  /**
   * REGR-1 — export an anonymized regression-scenario candidate from a
   * rejected action. The candidate pins "this target must not be proposed
   * again under these inputs"; it is adopted into the CI gate together with
   * the behavior fix that makes it pass. Tenant names/domains/ids never
   * leave: only behavioral inputs survive anonymization.
   */
  async regressionCandidate(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    const action = await this.repo.getAgentAction(tenantId, id);
    if (!action) return { status: 404, body: { error: 'action not found' } };
    if (action.approval_status !== 'rejected') {
      return {
        status: 409,
        body: { error: 'only rejected actions can become regression candidates' },
      };
    }
    const labels = await this.repo.listFeedbackLabels(tenantId, `agent_action:${id}`);
    const rejection = labels.find((l) => l.label === 'rejected');
    const accounts = await this.repo.listAccounts(tenantId);
    const contacts = (
      await Promise.all(accounts.map((a) => this.repo.listContactsByAccount(tenantId, a.id)))
    ).flat();
    const scenario = buildRegressionScenario({
      action: { id: action.id, action_type: action.action_type, target_ref: action.target_ref },
      reasonCode:
        typeof rejection?.detail['reason_code'] === 'string'
          ? (rejection.detail['reason_code'] as string)
          : 'other',
      note:
        typeof rejection?.detail['note'] === 'string'
          ? (rejection.detail['note'] as string)
          : undefined,
      accounts,
      contacts,
    });
    return { status: 200, body: { candidate: scenario } };
  }

  /**
   * WHY-1 — decision rationale (read-only; viewer-allowed). The deterministic
   * "why this action" for the operator: fit/timing score, the grounding CRM
   * facts (canonical evidence), and data freshness with a stale-since-proposal
   * flag. Makes the approval informed rather than blind.
   */
  async actionRationale(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    const action = await this.repo.getAgentAction(tenantId, id);
    if (!action) return { status: 404, body: { error: 'action not found' } };
    const accountId = action.target_ref.startsWith('account:')
      ? action.target_ref.slice('account:'.length)
      : null;
    const account = accountId ? await this.repo.getAccount(tenantId, accountId) : null;
    const contacts = account ? await this.repo.listContactsByAccount(tenantId, account.id) : [];
    return { status: 200, body: buildActionRationale(action, account, contacts) };
  }

  /** Decision labels for one action (or all for the tenant) — the eval feed. */
  async listActionDecisions(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id;
    const labels = await this.repo.listFeedbackLabels(
      tenantId,
      id ? `agent_action:${id}` : undefined,
    );
    return { status: 200, body: { decisions: labels } };
  }

  /**
   * Batch approve/reject (UX-2): one shared structured reason applied across the
   * selected ids. Each id is processed independently and reported per-id so a
   * partial failure (e.g. one already-decided action) never silently drops the
   * rest. The whole batch shares FLY-1's required-reason validation.
   */
  async batchApprove(req: ApiRequest): Promise<ApiResponse> {
    return this.batchDecide(req, 'approve');
  }
  async batchReject(req: ApiRequest): Promise<ApiResponse> {
    return this.batchDecide(req, 'reject');
  }

  private async batchDecide(req: ApiRequest, kind: 'approve' | 'reject'): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const parsed = batchDecisionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return {
        status: 400,
        body: { error: 'ids[] and a structured reason are required for a batch decision' },
      };
    }
    // Same closed-enum validation as the single-action path (FLY-1): the shared
    // reason must be a valid code for this decision kind; `other` requires a note.
    const schema = kind === 'approve' ? approveDecision : rejectDecision;
    const reasonParsed = schema.safeParse(parsed.data.reason);
    if (!reasonParsed.success) {
      return { status: 400, body: { error: `invalid ${kind} reason for batch` } };
    }
    const reason = {
      reasonCode: reasonParsed.data.reason_code,
      note: reasonParsed.data.note,
    };
    const approverRef = actorRef(req);
    // Sequential so the audit/label order is deterministic; batches are small.
    const results: Array<{ id: string; ok: boolean; status: number; error?: string }> = [];
    for (const id of parsed.data.ids) {
      try {
        if (kind === 'approve') {
          await this.services.ledger.approve(tenantId, id, approverRef, reason);
        } else {
          await this.services.ledger.reject(tenantId, id, approverRef, reason);
        }
        results.push({ id, ok: true, status: 200 });
      } catch (err) {
        const mapped = this.ledgerError(err);
        results.push({
          id,
          ok: false,
          status: mapped.status,
          error: (mapped.body as { error?: string }).error,
        });
      }
    }
    const succeeded = results.filter((r) => r.ok).length;
    // 200 if all succeeded; 207 (multi-status) when some ids failed.
    return {
      status: succeeded === results.length ? 200 : 207,
      body: { kind, requested: results.length, succeeded, results },
    };
  }

  async executeAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const id = req.params?.id ?? '';
    try {
      const action = await this.services.ledger.execute(tenantId, id);
      return { status: 200, body: action };
    } catch (err) {
      if (err instanceof ExecutionError) {
        // Refused (e.g. not approved) — 409 Conflict.
        return { status: 409, body: { error: err.message } };
      }
      return this.ledgerError(err);
    }
  }

  /**
   * GOV-1 — typed execution preview (read-only; viewers allowed). Returns the
   * exact CRM property map the write will carry, built by the same assembly
   * the execution path uses, plus policy facts (guardrails, denial reason,
   * expected idempotent replay).
   */
  async previewAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    try {
      const preview = await this.services.ledger.previewExecution(tenantId, id);
      return { status: 200, body: preview };
    } catch (err) {
      if (err instanceof ExecutionError) {
        return { status: 404, body: { error: 'action not found' } };
      }
      return this.ledgerError(err);
    }
  }

  // --- Accounts ---
  async listAccounts(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const accounts = await this.repo.listAccounts(tenantId);
    return { status: 200, body: { accounts } };
  }

  async getAccountContext(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    const account = await this.repo.getAccount(tenantId, id);
    if (!account) return { status: 404, body: { error: 'account not found' } };
    const contacts = await this.repo.listContactsByAccount(tenantId, id);
    const opportunities = await this.repo.listOpportunitiesByAccount(tenantId, id);
    return { status: 200, body: { account, contacts, opportunities } };
  }

  /** EVID-1 — opportunities visibility (read-only; viewer-allowed). */
  async listOpportunities(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const opportunities = await this.repo.listOpportunities(tenantId);
    return { status: 200, body: { opportunities } };
  }

  /** EVID-1 — integration sync history (read-only; viewer-allowed). */
  async listSyncRuns(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const sync_runs = await this.repo.listSyncRuns(tenantId);
    return { status: 200, body: { sync_runs } };
  }

  // --- Stubs (complete the surface; not part of Mira MVP) ---
  async listCampaigns(req: ApiRequest): Promise<ApiResponse> {
    requireTenant(req);
    return { status: 200, body: { campaigns: [] } };
  }
  async createCampaign(req: ApiRequest): Promise<ApiResponse> {
    requireTenant(req);
    return { status: 501, body: { error: 'not implemented' } };
  }
  async metricsOutbound(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const actions = await this.repo.listAgentActions(tenantId);
    const proposed = actions.filter((a) => a.approval_status === 'proposed').length;
    const approved = actions.filter((a) => a.approval_status === 'approved').length;
    const executed = actions.filter((a) => a.execution_status === 'executed').length;
    return { status: 200, body: { proposed, approved, executed } };
  }

  /**
   * MET-1 — tenant trust metrics, derived live from the ledger + decision
   * labels (read-only; viewers allowed). The numbers a design partner audits:
   * approval rate, reason mix, decision latency, duplicates prevented.
   */
  async metricsTrust(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const [actions, labels] = await Promise.all([
      this.repo.listAgentActions(tenantId),
      this.repo.listFeedbackLabels(tenantId),
    ]);
    return { status: 200, body: computeTrustMetrics(actions, labels) };
  }

  // --- ENF-1: enforced kill switch + governance/audit visibility ---

  /** Connection + kill-switch state for the deployment's CRM integration. */
  async integrationStatus(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const conn = await this.repo.getIntegrationConnection(tenantId, 'hubspot');
    return {
      status: 200,
      body: {
        system: 'hubspot',
        status: conn?.status ?? 'not_connected',
        updated_at: conn?.updated_at ?? null,
        kill_switch: {
          enforced: true,
          halted: conn !== null && conn.status !== 'active',
        },
      },
    };
  }

  /**
   * RDY-1 — connection readiness gate (read-only; viewer-allowed). Verifies
   * the HubSpot portal is correctly configured (required `cognitia_*`
   * properties present on Tasks & Notes, connection active) BEFORE the first
   * live write. Returns 503 with a clear reason when no read client is
   * configured (dev) — never a misleading "ready".
   */
  async integrationReadiness(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    if (!this.config.hubspotClient) {
      return {
        status: 503,
        body: {
          ready: false,
          reason: 'no HubSpot read client configured in this deployment',
        },
      };
    }
    const conn = await this.repo.getIntegrationConnection(tenantId, 'hubspot');
    const report = await checkHubspotReadiness(this.config.hubspotClient, {
      tenantId,
      connectionStatus: conn?.status ?? 'not_connected',
    });
    return { status: report.ready ? 200 : 409, body: report };
  }

  /** Emergency stop: any operator may pause. Audited. */
  async pauseIntegration(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const system = req.params?.system ?? 'hubspot';
    const updated = await this.repo.updateIntegrationConnectionStatus(tenantId, system, 'paused');
    if (!updated) return { status: 404, body: { error: `no ${system} connection for tenant` } };
    await this.auditIntegration(tenantId, actorRef(req), 'integration_paused', system);
    return { status: 200, body: { system, status: updated.status } };
  }

  /** Recovery: owner-only by design (see requireOwner). Audited. */
  async resumeIntegration(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const system = req.params?.system ?? 'hubspot';
    const updated = await this.repo.updateIntegrationConnectionStatus(tenantId, system, 'active');
    if (!updated) return { status: 404, body: { error: `no ${system} connection for tenant` } };
    await this.auditIntegration(tenantId, actorRef(req), 'integration_resumed', system);
    return { status: 200, body: { system, status: updated.status } };
  }

  private async auditIntegration(
    tenantId: string,
    actor: string,
    action: string,
    system: string,
  ): Promise<void> {
    await this.auditGovernance(tenantId, actor, action, `integration:${system}`, {});
  }

  private async auditGovernance(
    tenantId: string,
    actor: string,
    action: string,
    subjectRef: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    const ts = new Date().toISOString();
    await this.repo.insertAuditEvent({
      id: randomUUID(),
      tenant_id: tenantId,
      actor_ref: actor,
      action,
      subject_ref: subjectRef,
      detail,
      occurred_at: ts,
      created_at: ts,
    });
  }

  // --- PASS-1: agent passports + scope grants (identity-first execution) ---

  /** Passports + their grants (read-only; viewer-allowed governance surface). */
  async listPassports(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const passports = await this.repo.listAgentPassports(tenantId);
    const withGrants = await Promise.all(
      passports.map(async (p) => ({
        ...p,
        grants: await this.repo.listScopeGrants(tenantId, p.id),
      })),
    );
    return { status: 200, body: { passports: withGrants } };
  }

  /** Issue a passport (owner-only). One per agent per tenant; duplicates 409. */
  async createPassport(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const parsed = passportBody.safeParse(req.body ?? {});
    if (!parsed.success) return { status: 400, body: { error: 'agent_id is required' } };
    const existing = await this.repo.findAgentPassportByAgent(tenantId, parsed.data.agent_id);
    if (existing) {
      return {
        status: 409,
        body: { error: `passport already exists for ${parsed.data.agent_id}` },
      };
    }
    const ts = new Date().toISOString();
    const passport = await this.repo.createAgentPassport({
      id: randomUUID(),
      tenant_id: tenantId,
      agent_id: parsed.data.agent_id,
      owner_ref: actorRef(req),
      status: 'active',
      key_ref: parsed.data.key_ref ?? null,
      created_at: ts,
      updated_at: ts,
    });
    await this.auditGovernance(
      tenantId,
      actorRef(req),
      'passport_issued',
      `agent_passport:${passport.id}`,
      {
        agent_id: passport.agent_id,
      },
    );
    return { status: 201, body: passport };
  }

  /** Revoke a passport (owner-only). All future executions fail closed. */
  async revokePassport(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const id = req.params?.id ?? '';
    const updated = await this.repo.updateAgentPassportStatus(tenantId, id, 'revoked');
    if (!updated) return { status: 404, body: { error: 'passport not found' } };
    await this.auditGovernance(
      tenantId,
      actorRef(req),
      'passport_revoked',
      `agent_passport:${id}`,
      {
        agent_id: updated.agent_id,
      },
    );
    return { status: 200, body: updated };
  }

  /**
   * Approve a scope grant (owner-only — the approval is a human owner
   * decision; there is no agent self-approval or implicit path). Narrow and
   * explicit: action_type × integration × risk ceiling × mandatory expiry.
   */
  async issueGrant(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const passportId = req.params?.id ?? '';
    const parsed = grantBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return {
        status: 400,
        body: { error: 'action_type, integration, risk_max, and expires_at are required' },
      };
    }
    const passport = await this.repo.getAgentPassport(tenantId, passportId);
    if (!passport) return { status: 404, body: { error: 'passport not found' } };
    const ts = new Date().toISOString();
    const grant = await this.repo.createScopeGrant({
      id: randomUUID(),
      tenant_id: tenantId,
      passport_id: passportId,
      action_type: parsed.data.action_type,
      integration: parsed.data.integration,
      risk_max: parsed.data.risk_max,
      status: 'active',
      approved_by: actorRef(req),
      approved_at: ts,
      expires_at: parsed.data.expires_at,
      revoked_at: null,
      revoked_by: null,
      created_at: ts,
      updated_at: ts,
    });
    await this.auditGovernance(tenantId, actorRef(req), 'grant_issued', `scope_grant:${grant.id}`, {
      passport_id: passportId,
      agent_id: passport.agent_id,
      action_type: grant.action_type,
      integration: grant.integration,
      risk_max: grant.risk_max,
      expires_at: grant.expires_at,
    });
    return { status: 201, body: grant };
  }

  /** Revoke a grant (owner-only). Effective immediately for future executions. */
  async revokeGrant(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const passportId = req.params?.id ?? '';
    const grantId = req.params?.grantId ?? '';
    const grants = await this.repo.listScopeGrants(tenantId, passportId);
    if (!grants.some((g) => g.id === grantId)) {
      return { status: 404, body: { error: 'grant not found for passport' } };
    }
    const revoked = await this.repo.revokeScopeGrant(
      tenantId,
      grantId,
      actorRef(req),
      new Date().toISOString(),
    );
    if (!revoked) return { status: 404, body: { error: 'grant not found' } };
    await this.auditGovernance(tenantId, actorRef(req), 'grant_revoked', `scope_grant:${grantId}`, {
      passport_id: passportId,
      action_type: revoked.action_type,
      integration: revoked.integration,
    });
    return { status: 200, body: revoked };
  }

  /** ENF-1 — code-derived governance matrix (read-only; viewer-allowed). */
  async governance(req: ApiRequest): Promise<ApiResponse> {
    requireTenant(req);
    return { status: 200, body: buildGovernanceMatrix(this.services.deps.adapters) };
  }

  /** ENF-1 — queryable audit trail (read-only; viewer-allowed; newest first). */
  async auditTrail(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const limit = Math.min(Number(req.query?.limit ?? 100) || 100, 500);
    const all = await this.repo.listAuditEvents(tenantId);
    const events = [...all].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
    return { status: 200, body: { events, total: all.length } };
  }

  /**
   * SEC-1 — verify the tenant's tamper-evident audit chain (read-only;
   * viewer-allowed so a security reviewer can check it independently). Walks
   * every audit event from genesis and recomputes each hash link; any
   * mutation, deletion, fork, or unchained row surfaces as a named failure.
   */
  async verifyAudit(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const events = await this.repo.listAuditEvents(tenantId);
    const result = verifyAuditChain(events);
    return { status: 200, body: result };
  }

  /**
   * SEC-2 — one-click, self-verifying export of a contact's full action +
   * approval chain (operator+; the export access is itself logged to the audit
   * trail so a compliance reviewer can see who pulled what, when). The embedded
   * chain_verification lets the reviewer recompute integrity independently.
   */
  async exportContactAudit(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const contactId = req.params?.id ?? '';
    const actor = actorRef(req);
    try {
      const bundle = await buildContactAuditExport(this.repo, tenantId, contactId, {
        generatedBy: actor,
        retentionDays: Number(req.query?.retention_days) || undefined,
      });
      // Log the export access (append-only); the bundle's proof was computed
      // BEFORE this event, so it reflects exactly what the reviewer received.
      await this.auditGovernance(tenantId, actor, 'audit_exported', `contact:${contactId}`, {
        action_count: bundle.action_count,
        events: bundle.approval_chain.length,
        chain_ok: bundle.chain_verification.ok,
      });
      return { status: 200, body: bundle };
    } catch (err) {
      if (err instanceof ContactNotFoundError) throw new HttpError(404, err.message);
      throw err;
    }
  }

  /**
   * SEC-2 — tenant-wide retention status (read-only; viewer-allowed). Proves the
   * minimum-retention floor is met and flags archival-eligible events. Append-
   * only ⇒ nothing is ever silently dropped, so the floor holds by construction.
   */
  async auditRetention(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const status = await buildRetentionStatus(this.repo, tenantId, {
      retentionDays: Number(req.query?.retention_days) || undefined,
    });
    return { status: 200, body: status };
  }

  /**
   * CRM-2 — signal-driven stage-update review (operator+). Scans the event
   * stream for booked-meeting signals against opportunities and proposes
   * approval-gated crm.stage.update actions (medium risk: never auto-approved).
   * Execution then rides the existing ledger path: one idempotent write,
   * crm.opportunity.stage_updated.v1 on success, crm.push.failed.v1 on error.
   */
  async stageReview(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const result = await runStageReview(
      this.services,
      this.repo,
      tenantId,
      req.traceId ?? 'trace-stage-review',
    );
    return { status: 200, body: result };
  }

  /**
   * AUTH-2 — exportable access-review evidence (owner-only). The tenant's SSO
   * policy (IdP, protocol, group→role mapping — signing key excluded) plus
   * observed access derived from the immutable audit trail (who acted, how
   * often, last seen). The export is itself audited.
   */
  async accessReview(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const review = await buildAccessReview(this.repo, tenantId, this.config.ssoConfigStore);
    await this.auditGovernance(
      tenantId,
      actorRef(req),
      'access_review_exported',
      `tenant:${tenantId}`,
      {
        user_count: review.user_count,
        sso_configured: review.sso.configured,
      },
    );
    return { status: 200, body: review };
  }

  /**
   * Audit-chain anchoring (owner-only): publish the current chain tip to the
   * external anchor sink so later tampering is detectable. The anchoring is
   * itself audited (`audit_chain_anchored`).
   */
  async anchorAudit(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const record = await anchorAuditChain(this.repo, tenantId, this.anchorSink);
    await this.auditGovernance(
      tenantId,
      actorRef(req),
      'audit_chain_anchored',
      `tenant:${tenantId}`,
      {
        events: record.events,
        tip_hash: record.tip_hash,
        chain_ok: record.chain_ok,
      },
    );
    return { status: 200, body: record };
  }

  /**
   * Verify the live audit chain against the latest anchor (read-only; viewer-
   * allowed so a security reviewer can check independently). `consistent: false`
   * with `anchored_tip_absent` means history was rewritten/truncated.
   */
  async verifyAuditAnchor(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const result = await verifyAgainstLatestAnchor(this.repo, tenantId, this.anchorSink);
    return { status: 200, body: result };
  }

  /**
   * DSAR — data-subject access export (owner-only; the access is itself audited
   * as `dsar_exported`). Personal data + processing record + audit trail.
   */
  async dsarExport(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const contactId = req.params?.id ?? '';
    try {
      const bundle = await buildDsarExport(this.repo, tenantId, contactId, {
        generatedBy: actorRef(req),
      });
      await this.auditGovernance(tenantId, actorRef(req), 'dsar_exported', `contact:${contactId}`, {
        actions: bundle.actions.length,
        events: bundle.audit_trail.length,
      });
      return { status: 200, body: bundle };
    } catch (err) {
      if (err instanceof DsarContactNotFoundError) throw new HttpError(404, err.message);
      throw err;
    }
  }

  /**
   * DSAR — right-to-erasure (owner-only). Anonymizes the contact's PII and
   * records the erasure as an audit event (`contact_data_erased`) — the audit
   * chain itself is preserved (it never stored raw PII). Idempotent.
   */
  async dsarErase(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const contactId = req.params?.id ?? '';
    try {
      const result = await eraseContactData(this.repo, tenantId, contactId, {
        erasedBy: actorRef(req),
      });
      await this.auditGovernance(
        tenantId,
        actorRef(req),
        'contact_data_erased',
        `contact:${contactId}`,
        { status: result.status },
      );
      return { status: 200, body: result };
    } catch (err) {
      if (err instanceof DsarContactNotFoundError) throw new HttpError(404, err.message);
      throw err;
    }
  }

  /**
   * OBS-1 — operations overview (read-only; viewer-allowed). Failure events,
   * sync_run health, action-ledger status mix, and worker-heartbeat liveness in
   * one dashboard read-model. Refs only — never raw PII.
   */
  async opsOverview(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const staleAfter = Number(req.query?.stale_after_minutes) || undefined;
    const overview = await buildOpsOverview(this.repo, tenantId, {
      staleAfterMinutes: staleAfter,
    });
    return { status: 200, body: overview };
  }

  /**
   * LEARN-1 — per-segment governance scorecards (read-only; viewer-allowed).
   * Approval rate, reason mixes, latency, and rollback per action_type × risk
   * tier — the performance evidence for governed actions and the data-derived
   * basis for earned-autonomy gating.
   */
  async metricsScorecards(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const [actions, labels] = await Promise.all([
      this.repo.listAgentActions(tenantId),
      this.repo.listFeedbackLabels(tenantId),
    ]);
    return { status: 200, body: computeScorecards(actions, labels) };
  }

  /**
   * TRUST-2 — exportable trust packet (read-only; viewer-allowed so a
   * procurement/security reviewer can pull it). Live-derived; the eval gate
   * is re-run at export time and embedded.
   */
  async trustPacket(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const packet = await buildTrustPacket(this.repo, tenantId, this.services.deps.adapters);
    return { status: 200, body: packet };
  }
  async webhookHubspot(req: ApiRequest): Promise<ApiResponse> {
    // --- Fail closed: verify the HubSpot v3 signature before trusting anything. ---
    const verification = this.verifyHubspotWebhook(req);
    if (!verification.ok) {
      return { status: verification.status, body: { error: verification.error } };
    }

    const tenantId = requireTenant(req);
    const parsed = hubspotContactWebhook.safeParse(req.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: parsed.error.message } };
    }
    // Idempotent: a duplicate webhook resolves to the same contact (no dupes).
    const { contactId, created } = await this.repo.ingestExternalContact({
      tenantId,
      externalSystem: 'hubspot',
      externalId: parsed.data.externalId,
      contact: {
        fullName: parsed.data.fullName ?? null,
        title: parsed.data.title ?? null,
        emailHash: parsed.data.emailHash ?? null,
      },
    });
    return { status: created ? 201 : 200, body: { contactId, created } };
  }
  /**
   * Documented n8n seams that are NOT implemented yet. They previously
   * returned fake success (202 received/enqueued) while doing nothing — an
   * unauthenticated endpoint must never claim work it didn't perform. 501
   * keeps the contract discoverable and truthful until the real (signed,
   * authenticated) implementations land.
   */
  async webhookInboundLead(_req: ApiRequest): Promise<ApiResponse> {
    return { status: 501, body: { error: 'not_implemented' } };
  }
  async crmSyncJob(_req: ApiRequest): Promise<ApiResponse> {
    return { status: 501, body: { error: 'not_implemented' } };
  }

  /**
   * Verify a HubSpot v3 webhook. Fails closed: if verification cannot be
   * performed (no secret / missing headers / no raw body), the request is
   * rejected and the handler does NOT continue. Logging is PII-safe — only a
   * reason code and trace id, never the body, headers, or signature.
   */
  private verifyHubspotWebhook(
    req: ApiRequest,
  ): { ok: true } | { ok: false; status: number; error: string } {
    const reject = (status: number, reason: string) => {
      log({
        level: 'warn',
        message: `webhook.hubspot.rejected:${reason}`,
        trace_id: req.traceId,
      });
      return { ok: false as const, status, error: reason };
    };

    const secret = this.config.hubspotWebhookSecret;
    if (!secret) {
      // Cannot verify -> do not trust the payload.
      return reject(503, 'verification_not_configured');
    }
    const headers = req.headers ?? {};
    const signature = headers['x-hubspot-signature-v3'];
    const timestamp = headers['x-hubspot-request-timestamp'];
    if (!signature || !timestamp) {
      return reject(401, 'missing_signature_headers');
    }
    if (req.rawBody === undefined || req.fullUri === undefined) {
      // Raw body / URI weren't captured -> verification impossible.
      return reject(400, 'raw_body_unavailable');
    }

    const valid = verifyHubspotSignatureV3({
      method: req.method ?? 'POST',
      uri: req.fullUri,
      body: req.rawBody,
      signature,
      timestamp,
      clientSecret: secret,
      now: this.config.now,
    });
    // verifyHubspotSignatureV3 returns false for both bad signatures and
    // expired/replayed timestamps (outside the 5-minute window).
    if (!valid) {
      return reject(401, 'invalid_signature');
    }
    return { ok: true };
  }

  private ledgerError(err: unknown): ApiResponse {
    if (err instanceof InvalidDecisionError) return { status: 400, body: { error: err.message } };
    if (err instanceof ExecutionError) return { status: 404, body: { error: err.message } };
    return { status: 500, body: { error: err instanceof Error ? err.message : 'error' } };
  }
}
