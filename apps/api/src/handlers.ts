import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Repository } from '@cognitia/db';
import type { GtmServices } from '@cognitia/agents';
import { ExecutionError, InvalidDecisionError } from '@cognitia/agents';
import {
  verifyHubspotSignatureV3,
  checkHubspotReadiness,
  type HubspotClient,
} from '@cognitia/integrations';
import { approveDecision, rejectDecision, log } from '@cognitia/core';
import { MUTATING_ROLES, type Role } from './auth.js';
import { computeTrustMetrics } from './trustMetrics.js';
import { runPreflight } from './preflight.js';
import { buildTrustPacket } from './trustPacket.js';
import { buildGovernanceMatrix } from './governance.js';
import { buildRegressionScenario } from '@cognitia/evals';
import { buildActionRationale } from './rationale.js';
import { computeScorecards } from './scorecards.js';
import { buildRunPlans } from './runPlans.js';
import {
  createProof,
  supersedeProof,
  runRedactionCheck,
  toPublicProof,
  ProofNotFoundError,
} from './proofs.js';
import {
  registerAgent,
  issueAtc,
  transitionAtc,
  AgentNotFoundError,
  AtcNotFoundError,
  IllegalAtcTransitionError,
  type AtcLifecycleAction,
} from './atc.js';

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

/** Map proof-service failures onto HTTP statuses (400 invalid, 404 missing). */
function toProofHttpError(err: unknown): unknown {
  if (err instanceof ProofNotFoundError) return new HttpError(404, err.message);
  if (err instanceof z.ZodError) {
    return new HttpError(
      400,
      err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return err;
}

/** Map ATC-service failures onto HTTP statuses (400/404/409). */
function toAtcHttpError(err: unknown): unknown {
  if (err instanceof AgentNotFoundError || err instanceof AtcNotFoundError) {
    return new HttpError(404, err.message);
  }
  if (err instanceof IllegalAtcTransitionError) return new HttpError(409, err.message);
  if (err instanceof Error && /duplicate key/i.test(err.message)) {
    return new HttpError(409, 'an agent with this slug already exists');
  }
  return toProofHttpError(err);
}

const permissionsPutBody = z.object({
  permissions: z
    .array(
      z.object({
        action_key: z.string().min(1),
        effect: z.enum(['allow', 'deny']),
        constraints: z.record(z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(50),
});

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
  constructor(
    private readonly repo: Repository,
    private readonly services: GtmServices,
    private readonly config: ApiHandlersConfig = {},
  ) {}

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

  async getAgentRun(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    const run = await this.repo.getAgentRun(tenantId, id);
    if (!run) return { status: 404, body: { error: 'agent_run not found' } };
    return { status: 200, body: run };
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
      const action = await this.services.ledger.approve(tenantId, id, `user:${req.role}`, {
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
      const action = await this.services.ledger.reject(tenantId, id, `user:${req.role}`, {
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
      const action = await this.services.ledger.rollback(tenantId, id, `user:${req.role}`, {
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
    const approverRef = `user:${req.role}`;
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
    return { status: 200, body: { account, contacts } };
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
    await this.auditIntegration(tenantId, req.role ?? 'operator', 'integration_paused', system);
    return { status: 200, body: { system, status: updated.status } };
  }

  /** Recovery: owner-only by design (see requireOwner). Audited. */
  async resumeIntegration(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    const system = req.params?.system ?? 'hubspot';
    const updated = await this.repo.updateIntegrationConnectionStatus(tenantId, system, 'active');
    if (!updated) return { status: 404, body: { error: `no ${system} connection for tenant` } };
    await this.auditIntegration(tenantId, req.role ?? 'owner', 'integration_resumed', system);
    return { status: 200, body: { system, status: updated.status } };
  }

  private async auditIntegration(
    tenantId: string,
    role: string,
    action: string,
    system: string,
  ): Promise<void> {
    const ts = new Date().toISOString();
    await this.repo.insertAuditEvent({
      id: randomUUID(),
      tenant_id: tenantId,
      actor_ref: `user:${role}`,
      action,
      subject_ref: `integration:${system}`,
      detail: {},
      occurred_at: ts,
      created_at: ts,
    });
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

  // --- COG-003: Cognitia Proof Registry ---

  /** Operator proof list (viewer-allowed). Full rows incl. details_private. */
  async listProofs(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const proofs = await this.repo.listProofs(tenantId, {
      evidenceTag: req.query?.evidence_tag,
      kind: req.query?.kind,
      publicSafe:
        req.query?.public_safe === undefined ? undefined : req.query.public_safe === 'true',
    });
    return { status: 200, body: { proofs } };
  }

  /**
   * Public-safe projection: ONLY redaction-checked rows, ONLY the public
   * fields (never details_private / evidence_ref / verifier_ref / subject_id).
   */
  async listPublicProofs(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const rows = await this.repo.listProofs(tenantId, { publicSafe: true });
    return { status: 200, body: { proofs: rows.map(toPublicProof) } };
  }

  async createProof(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const proof = await createProof(
        this.repo,
        tenantId,
        req.body,
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 201, body: { proof } };
    } catch (err) {
      throw toProofHttpError(err);
    }
  }

  async supersedeProof(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const proof = await supersedeProof(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 201, body: { proof } };
    } catch (err) {
      throw toProofHttpError(err);
    }
  }

  // --- COG-004: agents + Agent Trust Credentials + permissions ---

  /** Agent list with each agent's newest ATC status (viewer-allowed). */
  async listAgentsWithAtc(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const agents = await this.repo.listAgents(tenantId);
    const withAtc = await Promise.all(
      agents.map(async (agent) => {
        const atcs = await this.repo.listAtcsByAgent(tenantId, agent.id);
        return { ...agent, atc_status: atcs[0]?.status ?? 'none', atc_count: atcs.length };
      }),
    );
    return { status: 200, body: { agents: withAtc } };
  }

  /** Agent detail: agent + ATC history + permissions (viewer-allowed). */
  async getAgentDetail(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    const agent = await this.repo.getAgent(tenantId, id);
    if (!agent) throw new HttpError(404, `agent not found: ${id}`);
    const [atcs, permissions] = await Promise.all([
      this.repo.listAtcsByAgent(tenantId, id),
      this.repo.listAgentPermissions(tenantId, id),
    ]);
    return { status: 200, body: { agent, atcs, permissions } };
  }

  async registerAgent(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await registerAgent(
        this.repo,
        tenantId,
        req.body,
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 201, body: result };
    } catch (err) {
      throw toAtcHttpError(err);
    }
  }

  async issueAtc(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const atc = await issueAtc(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body ?? {},
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 201, body: { atc } };
    } catch (err) {
      throw toAtcHttpError(err);
    }
  }

  /**
   * Lifecycle transitions. Suspend/resume/expire are operator actions;
   * REVOKE is owner-only — it is terminal, matching the kill-switch
   * asymmetry (cheap to pause, deliberate to do something irreversible).
   */
  async atcTransition(req: ApiRequest, action: AtcLifecycleAction): Promise<ApiResponse> {
    const tenantId = action === 'revoke' ? requireOwner(req) : requireMutatingRole(req);
    try {
      const atc = await transitionAtc(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        action,
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 200, body: { atc } };
    } catch (err) {
      if (err instanceof Error && /revoked credentials cannot change status/i.test(err.message)) {
        throw new HttpError(409, err.message);
      }
      throw toAtcHttpError(err);
    }
  }

  async listAgentPermissions(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const permissions = await this.repo.listAgentPermissions(tenantId, req.params?.id ?? '');
    return { status: 200, body: { permissions } };
  }

  /**
   * Replace/insert permissions for an agent. Doctrine guard: flipping
   * `sms.send_real` to ALLOW is owner-only — an operator can never quietly
   * enable real outbound SMS (Architecture Lock §8).
   */
  async putAgentPermissions(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const agentId = req.params?.id ?? '';
    const agent = await this.repo.getAgent(tenantId, agentId);
    if (!agent) throw new HttpError(404, `agent not found: ${agentId}`);
    const parsed = permissionsPutBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: parsed.error.message } };
    }
    const escalatesRealSms = parsed.data.permissions.some(
      (p) => p.action_key === 'sms.send_real' && p.effect === 'allow',
    );
    if (escalatesRealSms && req.role !== 'owner') {
      throw new HttpError(403, 'forbidden: allowing sms.send_real requires the owner role');
    }
    const ts = new Date().toISOString();
    const saved = [];
    for (const p of parsed.data.permissions) {
      saved.push(
        await this.repo.upsertAgentPermission({
          id: randomUUID(),
          tenant_id: tenantId,
          agent_id: agentId,
          action_key: p.action_key,
          effect: p.effect,
          constraints: p.constraints,
          created_at: ts,
          updated_at: ts,
        }),
      );
      await this.repo.insertAuditEvent({
        id: randomUUID(),
        tenant_id: tenantId,
        actor_ref: `user:${req.role}`,
        action: 'agent.permission.set.v1',
        subject_ref: `agent:${agentId}`,
        detail: { action_key: p.action_key, effect: p.effect },
        occurred_at: ts,
        created_at: ts,
      });
    }
    return { status: 200, body: { permissions: saved } };
  }

  async proofRedactionCheck(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const outcome = await runRedactionCheck(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return {
        status: 200,
        body: {
          proof: outcome.proof,
          publish_safe: outcome.scan.publish_safe,
          findings: outcome.findings,
        },
      };
    } catch (err) {
      throw toProofHttpError(err);
    }
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
  async webhookInboundLead(_req: ApiRequest): Promise<ApiResponse> {
    return { status: 202, body: { received: true } };
  }
  async crmSyncJob(_req: ApiRequest): Promise<ApiResponse> {
    return { status: 202, body: { enqueued: true } };
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
