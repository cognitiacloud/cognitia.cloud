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
import {
  ingestLead,
  toMaskedLead,
  toLeadDetail,
  draftReply,
  executeSimulatedSend,
  purgeLeadPii,
  proposeLeadAction,
  createLeadOutcome,
  getLeadRescueSummary,
  LeadNotFoundError,
  LeadPurgedError,
  FrontDeskActionNotFoundError,
  NotApprovedError,
  RealSendRefusedError,
  OutcomeEvidenceError,
} from './frontdesk.js';
import { getAgentReputation, recomputeSnapshot } from './reputation.js';
import { buildCommandSummary } from './commandSummary.js';
import {
  openAccount,
  getAccountView,
  transfer,
  createWalletBinding,
  deactivateWalletBinding,
  CreditsAccountNotFoundError,
  AccountNotActiveError,
  InsufficientCreditsError,
  RailNotEnabledError,
  WalletBindingNotFoundError,
} from './credits.js';
import {
  createWorkOrder,
  acceptWorkOrder,
  deliverWorkOrder,
  verifyWorkOrder,
  rejectWorkOrder,
  disputeWorkOrder,
  resolveWorkOrderDispute,
  cancelWorkOrder,
  getWorkOrderView,
  buildEconomySummary,
  WorkOrderNotFoundError,
  IllegalWorkOrderTransitionError,
  WorkerAtcRequiredError,
  SelfAcceptError,
  WorkOrderProofError,
  EscrowReleaseRefusedError,
  DisputeSplitError,
  SkillVersionNotFoundForWorkError,
} from './agentEconomy.js';
import {
  proposeWorkOrderAgentAction,
  executeWorkOrderAgentAction,
  listEconomyAgentActions,
  type EconomyActionKind,
  EconomyPermissionDeniedError,
  NotAgentProposableError,
  WorkerMismatchError,
  EconomyActionNotFoundError,
  EconomyActionNotApprovedError,
  EconomyActionAlreadyExecutedError,
} from './agentEconomyActions.js';
import {
  createListing,
  setListingStatus,
  buildMarketplaceView,
  createWorkOrderFromListing,
  ListingNotFoundError,
  ListingNotActiveError,
  ListingTargetError,
} from './marketplace.js';
import {
  importCoreSkills,
  createSkillProof,
  validateProofTierUpgrade,
  yankSkillVersion,
  SkillVersionNotFoundError,
  SkillVersionYankedError,
  SkillProofTargetError,
  TierNotAssignableError,
  TierEvidenceError,
} from './skillproof.js';

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

/** Map front-desk failures onto HTTP statuses (400/403/404/409). */
function toFrontDeskHttpError(err: unknown): unknown {
  if (err instanceof LeadNotFoundError || err instanceof FrontDeskActionNotFoundError) {
    return new HttpError(404, err.message);
  }
  if (err instanceof LeadPurgedError) return new HttpError(409, err.message);
  if (err instanceof NotApprovedError) return new HttpError(409, err.message);
  if (err instanceof RealSendRefusedError) return new HttpError(403, err.message);
  if (err instanceof OutcomeEvidenceError) return new HttpError(400, err.message);
  return toProofHttpError(err);
}

/** Map credits failures onto HTTP statuses (400/404/409/422). */
/** Agent Economy Lab errors (validation first, then domain mappings). */
function toEconomyHttpError(err: unknown): unknown {
  if (err instanceof WorkOrderNotFoundError) return new HttpError(404, err.message);
  if (err instanceof SkillVersionNotFoundForWorkError) return new HttpError(404, err.message);
  if (err instanceof AgentNotFoundError) return new HttpError(404, err.message);
  if (err instanceof IllegalWorkOrderTransitionError) return new HttpError(409, err.message);
  if (err instanceof WorkerAtcRequiredError) return new HttpError(403, err.message);
  if (err instanceof SelfAcceptError) return new HttpError(409, err.message);
  if (err instanceof WorkOrderProofError) return new HttpError(409, err.message);
  if (err instanceof EscrowReleaseRefusedError) return new HttpError(409, err.message);
  if (err instanceof DisputeSplitError) return new HttpError(422, err.message);
  if (err instanceof EconomyPermissionDeniedError) return new HttpError(403, err.message);
  if (err instanceof NotAgentProposableError) return new HttpError(403, err.message);
  if (err instanceof WorkerMismatchError) return new HttpError(403, err.message);
  if (err instanceof EconomyActionNotFoundError) return new HttpError(404, err.message);
  if (err instanceof EconomyActionNotApprovedError) return new HttpError(409, err.message);
  if (err instanceof EconomyActionAlreadyExecutedError) return new HttpError(409, err.message);
  if (err instanceof ListingNotFoundError) return new HttpError(404, err.message);
  if (err instanceof ListingTargetError) return new HttpError(404, err.message);
  if (err instanceof ListingNotActiveError) return new HttpError(409, err.message);
  if (err instanceof SkillVersionYankedError) return new HttpError(409, err.message);
  // Escrow movements reuse the credits service — surface its errors faithfully.
  return toCreditsHttpError(err);
}

function toCreditsHttpError(err: unknown): unknown {
  if (err instanceof CreditsAccountNotFoundError) return new HttpError(404, err.message);
  if (err instanceof AccountNotActiveError) return new HttpError(409, err.message);
  if (err instanceof InsufficientCreditsError) return new HttpError(422, err.message);
  if (err instanceof RailNotEnabledError) return new HttpError(400, err.message);
  // Validation errors first (toProofHttpError maps ZodError → 400), THEN the
  // DB-constraint regex fallback — zod messages can contain 'placeholder'.
  const mapped = toProofHttpError(err);
  if (mapped instanceof HttpError) return mapped;
  if (err instanceof Error && /placeholder|ledger_internal_rail_only|check/i.test(err.message)) {
    return new HttpError(409, err.message);
  }
  return err;
}

/** Map SkillProof failures onto HTTP statuses (400/403/404/409). */
function toSkillProofHttpError(err: unknown): unknown {
  if (err instanceof SkillVersionNotFoundError) return new HttpError(404, err.message);
  if (err instanceof SkillProofTargetError) return new HttpError(404, err.message);
  if (err instanceof SkillVersionYankedError) return new HttpError(409, err.message);
  if (err instanceof TierNotAssignableError) return new HttpError(403, err.message);
  if (err instanceof TierEvidenceError) return new HttpError(409, err.message);
  if (err instanceof Error && /verified_fact proof/i.test(err.message)) {
    return new HttpError(409, err.message);
  }
  return toProofHttpError(err);
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

  /**
   * V-4b — UNAUTHENTICATED, read-only public trust feed for the /trust/live
   * researcher surface. Hard safety properties:
   *   - the tenant is taken ONLY from server config (COGNITIA_PUBLIC_TENANT_ID),
   *     NEVER from the request — so this can't be used to enumerate tenants;
   *   - deny-by-default: with no public tenant configured it returns an empty
   *     feed (configured: false), never an error;
   *   - proofs are the public projection ONLY (no details_private, evidence_ref,
   *     verifier_ref, subject_id, tenant_id), and ONLY redaction-passed,
   *     public_safe rows;
   *   - reputation is an AGGREGATE summary only — counts, never agent ids or
   *     per-agent scores.
   * No writes. No PII. No token surface.
   */
  async publicTrustFeed(_req: ApiRequest): Promise<ApiResponse> {
    const publicTenant = process.env.COGNITIA_PUBLIC_TENANT_ID?.trim();
    if (!publicTenant) {
      return {
        status: 200,
        body: {
          configured: false,
          note: 'No public tenant is configured; nothing is published.',
          proofs: [],
          reputation: { agents_with_reputation: 0, total_events: 0, positive_events: 0 },
        },
      };
    }
    const rows = (await this.repo.listProofs(publicTenant, { publicSafe: true })).filter(
      (p) => p.redaction_check_passed_at != null,
    );
    const events = await this.repo.listReputationEvents(publicTenant);
    const positive = events.filter((e) => Number(e.delta) > 0).length;
    const agents = new Set(events.map((e) => e.agent_id)).size;
    return {
      status: 200,
      body: {
        configured: true,
        proofs: rows.map(toPublicProof),
        reputation: {
          agents_with_reputation: agents,
          total_events: events.length,
          positive_events: positive,
        },
      },
    };
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

  // --- COG-006: MoverOS AI Front Desk (simulation-first; no real SMS) ---

  async ingestLead(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await ingestLead(
        this.repo,
        tenantId,
        req.body,
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 201, body: result };
    } catch (err) {
      throw toFrontDeskHttpError(err);
    }
  }

  /** Masked list — raw PII never appears here (viewer-allowed). */
  async listLeads(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const leads = await this.repo.listLeadIntakes(tenantId);
    return { status: 200, body: { leads: leads.map((l) => toMaskedLead(l)) } };
  }

  /** Decrypted detail — operator/owner only (customer data on a need basis). */
  async getLeadDetail(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const lead = await this.repo.getLeadIntake(tenantId, req.params?.id ?? '');
    if (!lead) throw new HttpError(404, `lead intake not found: ${req.params?.id}`);
    return { status: 200, body: toLeadDetail(lead) };
  }

  /** Draft the AI reply and propose it into the existing approval queue. */
  async draftLeadReply(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await draftReply(
        this.repo,
        this.services,
        tenantId,
        req.params?.id ?? '',
        req.traceId ?? randomUUID(),
      );
      return { status: 201, body: result };
    } catch (err) {
      throw toFrontDeskHttpError(err);
    }
  }

  /** Execute an approved front-desk action as a SIMULATED send. */
  async executeFrontDeskAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const body = (req.body ?? {}) as { simulation?: boolean };
    try {
      const result = await executeSimulatedSend(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        { simulation: body.simulation },
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 200, body: result };
    } catch (err) {
      throw toFrontDeskHttpError(err);
    }
  }

  /** PIPEDA / BC PIPA: blank PII columns, flip pii_status to purged. */
  async purgeLeadPii(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const lead = await purgeLeadPii(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        `user:${req.role}`,
      );
      return { status: 200, body: { lead: toMaskedLead(lead) } };
    } catch (err) {
      throw toFrontDeskHttpError(err);
    }
  }

  /** Propose a front-desk action (qualify, callback, booking intent, …). */
  async proposeLeadAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await proposeLeadAction(
        this.repo,
        this.services,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 201, body: result };
    } catch (err) {
      throw toFrontDeskHttpError(err);
    }
  }

  /** Record an evidence-tagged lead outcome (revenue_outcome proof). */
  async createLeadOutcome(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await createLeadOutcome(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
        req.traceId ?? randomUUID(),
      );
      return { status: 201, body: result };
    } catch (err) {
      throw toFrontDeskHttpError(err);
    }
  }

  /** Lead Rescue dashboard numbers (viewer-allowed; no PII). */
  async leadRescueSummary(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    return { status: 200, body: await getLeadRescueSummary(this.repo, tenantId) };
  }

  // --- COG-008: Reputation v0 (read + recompute only; events are NEVER
  // posted directly — only proof-backed services create them) ---

  /** Agent reputation: score, events, latest snapshot (viewer-allowed). */
  async getAgentReputation(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const agentId = req.params?.id ?? '';
    const agent = await this.repo.getAgent(tenantId, agentId);
    if (!agent) throw new HttpError(404, `agent not found: ${agentId}`);
    return { status: 200, body: await getAgentReputation(this.repo, tenantId, agentId) };
  }

  /** Append a reproducible snapshot (no-op when already current). */
  async recomputeReputation(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const agentId = req.params?.id ?? '';
    const agent = await this.repo.getAgent(tenantId, agentId);
    if (!agent) throw new HttpError(404, `agent not found: ${agentId}`);
    const result = await recomputeSnapshot(this.repo, tenantId, agentId, `user:${req.role}`);
    return { status: 200, body: result };
  }

  // --- COG-007: Cognitia Command Dashboard summary (viewer-allowed; no PII) ---
  async commandSummary(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    return { status: 200, body: await buildCommandSummary(this.repo, tenantId) };
  }

  // --- COG-009: internal credits + wallet placeholders (Lane C) ---
  // INTERNAL accounting only: no real payments, no token, no pricing.

  async openCreditsAccount(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const account = await openAccount(this.repo, tenantId, req.body, `user:${req.role}`);
      return { status: 201, body: { account } };
    } catch (err) {
      throw toCreditsHttpError(err);
    }
  }

  async listCreditsAccounts(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const accounts = await this.repo.listCreditsAccounts(tenantId);
    const entries = await this.repo.listCreditsLedgerEntries(tenantId);
    const withBalances = accounts.map((a) => ({
      ...a,
      balance: entries.reduce(
        (total, e) =>
          e.account_id === a.id
            ? total + (e.direction === 'credit' ? Number(e.amount) : -Number(e.amount))
            : total,
        0,
      ),
    }));
    return { status: 200, body: { accounts: withBalances } };
  }

  async getCreditsAccount(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    try {
      const account = await getAccountView(this.repo, tenantId, req.params?.id ?? '');
      return { status: 200, body: { account } };
    } catch (err) {
      throw toCreditsHttpError(err);
    }
  }

  async getCreditsLedger(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const entries = await this.repo.listCreditsLedgerEntries(tenantId, req.params?.id);
    return { status: 200, body: { entries } };
  }

  async transferCredits(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await transfer(this.repo, tenantId, req.body, `user:${req.role}`);
      return { status: result.replayed ? 200 : 201, body: result };
    } catch (err) {
      throw toCreditsHttpError(err);
    }
  }

  async listWalletBindings(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    return { status: 200, body: { bindings: await this.repo.listWalletBindings(tenantId) } };
  }

  /** Placeholder bindings only; chain activation does not exist in v1.1. */
  async createWalletBinding(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const binding = await createWalletBinding(this.repo, tenantId, req.body, `user:${req.role}`);
      return { status: 201, body: { binding } };
    } catch (err) {
      throw toCreditsHttpError(err);
    }
  }

  async getWalletBinding(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const binding = await this.repo.getWalletBinding(tenantId, req.params?.id ?? '');
    if (!binding) throw new HttpError(404, `wallet binding not found: ${req.params?.id}`);
    return { status: 200, body: { binding } };
  }

  /** placeholder → deactivated (strictly more inert); no activation exists. */
  async deactivateWalletBinding(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const binding = await deactivateWalletBinding(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        `user:${req.role}`,
      );
      return { status: 200, body: { binding } };
    } catch (err) {
      if (err instanceof WalletBindingNotFoundError) throw new HttpError(404, err.message);
      throw toCreditsHttpError(err);
    }
  }

  /**
   * Internal crypto-readiness summary (Lane C, operator-only). States — and
   * the UI repeats — that everything beyond internal credits is
   * designed-for-later and legal-gated. No marketing language.
   */
  async cryptoReadiness(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const [accounts, entries, bindings] = await Promise.all([
      this.repo.listCreditsAccounts(tenantId),
      this.repo.listCreditsLedgerEntries(tenantId),
      this.repo.listWalletBindings(tenantId),
    ]);
    return {
      status: 200,
      body: {
        statement:
          "Cognitia's crypto layer is designed-for-later. Current implementation supports " +
          'internal credits, accounting primitives, and wallet binding placeholders only. ' +
          'Any public token, liquidity, staking, exchange, or payment execution requires ' +
          'legal review, real usage gates, and founder approval.',
        credits_accounts: accounts.length,
        ledger_entries: entries.length,
        wallet_bindings: bindings.length,
        conceptual_rails: [
          { rail: 'internal_credits', status: 'live' },
          { rail: 'card_stripe', status: 'designed-for-later' },
          { rail: 'usdc_base', status: 'designed-for-later' },
          { rail: 'usdt', status: 'designed-for-later' },
          { rail: 'future_cognitia_token', status: 'legal-gated' },
        ],
        token_public_status: 'disabled',
        legal_gate: 'not passed',
        real_payment_execution: 'disabled',
        base_evm_optionality: 'designed-for-later',
        future_integration_refs: ['x402', 'EAS', 'ERC-8004'],
        dex_or_liquidity_plan: 'none',
        staking_or_reward_programs: 'none',
        public_token_launch_readiness: 'none',
      },
    };
  }

  // --- AGENT-ECONOMY-001: Agent Economy Lab (internal, simulation-only) ---
  // Internal credits escrow + proof-backed completion. No real payments, no
  // token transfers, no public economy surface.

  async listWorkOrders(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const status = (req.query?.status as string | undefined) ?? undefined;
    const orders = await this.repo.listWorkOrders(tenantId, status ? { status } : undefined);
    return { status: 200, body: { work_orders: orders } };
  }

  async getWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    try {
      const order = await getWorkOrderView(this.repo, tenantId, req.params?.id ?? '');
      return { status: 200, body: order };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async createWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const order = await createWorkOrder(this.repo, tenantId, req.body, `user:${req.role}`);
      return { status: 201, body: { work_order: order } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async acceptWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const order = await acceptWorkOrder(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
      );
      return { status: 200, body: { work_order: order } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async deliverWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const order = await deliverWorkOrder(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
        req.traceId ?? 'trace-economy',
      );
      return { status: 200, body: { work_order: order } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  /** Verification releases escrow — owner-only, like every payout-shaped action. */
  async verifyWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    try {
      const order = await verifyWorkOrder(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        `user:${req.role}`,
      );
      return { status: 200, body: { work_order: order } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async rejectWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const order = await rejectWorkOrder(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
      );
      return { status: 200, body: { work_order: order } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async disputeWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const order = await disputeWorkOrder(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
      );
      return { status: 200, body: { work_order: order } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  /** Arbitration moves held escrow — owner-only, like verification. */
  async resolveWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireOwner(req);
    try {
      const order = await resolveWorkOrderDispute(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
        req.traceId ?? 'trace-economy',
      );
      return { status: 200, body: { work_order: order } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async cancelWorkOrder(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const order = await cancelWorkOrder(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        `user:${req.role}`,
      );
      return { status: 200, body: { work_order: order } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async economySummary(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    return { status: 200, body: await buildEconomySummary(this.repo, tenantId) };
  }

  // --- AGENT-ECONOMY-003: agent-driven proposals through the Action Ledger.
  // Agents PROPOSE; humans approve on the existing ledger; a separate
  // operator-gated execute runs the safe service path. verify/resolve are
  // never agent-proposable.

  /** kind is fixed by the route (propose-accept / propose-deliver / propose-dispute). */
  async proposeEconomyAction(req: ApiRequest, kind: EconomyActionKind): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await proposeWorkOrderAgentAction(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        kind,
        req.body,
        `user:${req.role}`,
        req.traceId ?? 'trace-economy',
      );
      return { status: result.replayed ? 200 : 201, body: result };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async listEconomyActions(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    return { status: 200, body: { actions: await listEconomyAgentActions(this.repo, tenantId) } };
  }

  /** Execute an APPROVED economy agent action (approval via /agent-actions/:id/approve). */
  async executeEconomyAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await executeWorkOrderAgentAction(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        `user:${req.role}`,
        req.traceId ?? 'trace-economy',
      );
      return { status: 200, body: result };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  // --- AGENT-ECONOMY-004: internal marketplace skeleton + tier-aware
  // matching. INTERNAL ONLY (0018 check); no payments, no token venue.

  async getMarketplace(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    return { status: 200, body: await buildMarketplaceView(this.repo, tenantId) };
  }

  async createMarketplaceListing(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const listing = await createListing(this.repo, tenantId, req.body, `user:${req.role}`);
      return { status: 201, body: { listing } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  async setMarketplaceListingStatus(
    req: ApiRequest,
    status: 'active' | 'withdrawn',
  ): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const listing = await setListingStatus(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        status,
        `user:${req.role}`,
      );
      return { status: 200, body: { listing } };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  /** Order work straight off a listing (files the worker's accept ask when permitted). */
  async orderFromListing(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await createWorkOrderFromListing(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
        req.traceId ?? 'trace-economy',
      );
      return { status: 201, body: result };
    } catch (err) {
      throw toEconomyHttpError(err);
    }
  }

  // --- COG-005: SkillProof (internal-only; never a marketplace) ---

  async listSkills(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const skills = await this.repo.listSkills(tenantId);
    const withMeta = await Promise.all(
      skills.map(async (skill) => {
        const versions = await this.repo.listSkillVersions(tenantId, skill.id);
        const proofs = await this.repo.listSkillProofs(tenantId, skill.id);
        const top = versions.reduce((max, v) => Math.max(max, v.proof_tier), 0);
        return {
          ...skill,
          version_count: versions.length,
          proof_count: proofs.length,
          top_proof_tier: top,
          yanked: versions.length > 0 && versions.every((v) => v.yanked),
        };
      }),
    );
    return { status: 200, body: { skills: withMeta } };
  }

  async importCoreSkills(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const summary = await importCoreSkills(
      this.repo,
      tenantId,
      process.cwd().replace(/\/apps\/api$/, ''),
      `user:${req.role}`,
    );
    return { status: 200, body: summary };
  }

  async getSkillDetail(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const skill = await this.repo.getSkill(tenantId, req.params?.id ?? '');
    if (!skill) throw new HttpError(404, `skill not found: ${req.params?.id}`);
    const [versions, proofs] = await Promise.all([
      this.repo.listSkillVersions(tenantId, skill.id),
      this.repo.listSkillProofs(tenantId, skill.id),
    ]);
    return { status: 200, body: { skill, versions, proofs } };
  }

  async listSkillVersions(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const versions = await this.repo.listSkillVersions(tenantId, req.params?.id ?? '');
    return { status: 200, body: { versions } };
  }

  async createSkillProof(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    try {
      const result = await createSkillProof(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        req.body,
        `user:${req.role}`,
      );
      return { status: 201, body: result };
    } catch (err) {
      throw toSkillProofHttpError(err);
    }
  }

  async upgradeSkillVersionTier(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const tier = Number((req.body as { target_tier?: number })?.target_tier);
    if (!Number.isInteger(tier)) {
      return { status: 400, body: { error: 'target_tier (integer) is required' } };
    }
    try {
      const version = await validateProofTierUpgrade(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        tier,
      );
      return { status: 200, body: { version } };
    } catch (err) {
      throw toSkillProofHttpError(err);
    }
  }

  async yankSkillVersion(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const reason = String((req.body as { reason?: string })?.reason ?? '').trim();
    if (!reason) return { status: 400, body: { error: 'a reason is required to yank' } };
    try {
      const version = await yankSkillVersion(
        this.repo,
        tenantId,
        req.params?.id ?? '',
        reason,
        `user:${req.role}`,
      );
      return { status: 200, body: { version } };
    } catch (err) {
      throw toSkillProofHttpError(err);
    }
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
