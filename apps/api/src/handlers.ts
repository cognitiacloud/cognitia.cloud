import { z } from 'zod';
import type { Repository } from '@cognitia/db';
import type { GtmServices } from '@cognitia/agents';
import { ExecutionError } from '@cognitia/agents';
import { verifyHubspotSignatureV3 } from '@cognitia/integrations';
import { log } from '@cognitia/core';
import { MUTATING_ROLES, type Role } from './auth.js';

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

const rejectBody = z.object({ reason: z.string().optional() }).default({});

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
    try {
      const action = await this.services.ledger.approve(tenantId, id, `user:${req.role}`);
      return { status: 200, body: action };
    } catch (err) {
      return this.ledgerError(err);
    }
  }

  async rejectAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireMutatingRole(req);
    const id = req.params?.id ?? '';
    const parsed = rejectBody.safeParse(req.body ?? {});
    const reason = parsed.success ? parsed.data.reason : undefined;
    try {
      const action = await this.services.ledger.reject(tenantId, id, `user:${req.role}`, reason);
      return { status: 200, body: action };
    } catch (err) {
      return this.ledgerError(err);
    }
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
    if (err instanceof ExecutionError) return { status: 404, body: { error: err.message } };
    return { status: 500, body: { error: err instanceof Error ? err.message : 'error' } };
  }
}
