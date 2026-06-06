import { z } from 'zod';
import type { Repository } from '@cognitia/db';
import type { GtmServices } from '@cognitia/agents';
import { ExecutionError } from '@cognitia/agents';

/**
 * Framework-agnostic request/response so handlers are unit-testable without a
 * running HTTP server. The Fastify binding (server.ts) adapts to these.
 */
export interface ApiRequest {
  tenantId?: string;
  params?: Record<string, string>;
  query?: Record<string, string | undefined>;
  body?: unknown;
  traceId?: string;
}
export interface ApiResponse {
  status: number;
  body: unknown;
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

function requireTenant(req: ApiRequest): string {
  if (!req.tenantId) {
    throw new HttpError(401, 'missing tenant (x-tenant-id header)');
  }
  return req.tenantId;
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
  ) {}

  async health(): Promise<ApiResponse> {
    return { status: 200, body: { status: 'ok', service: 'cognitia-api' } };
  }

  // --- Mira ---
  async runMira(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
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
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    try {
      const action = await this.services.ledger.approve(tenantId, id, 'user:operator');
      return { status: 200, body: action };
    } catch (err) {
      return this.ledgerError(err);
    }
  }

  async rejectAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
    const id = req.params?.id ?? '';
    const parsed = rejectBody.safeParse(req.body ?? {});
    const reason = parsed.success ? parsed.data.reason : undefined;
    try {
      const action = await this.services.ledger.reject(tenantId, id, 'user:operator', reason);
      return { status: 200, body: action };
    } catch (err) {
      return this.ledgerError(err);
    }
  }

  async executeAction(req: ApiRequest): Promise<ApiResponse> {
    const tenantId = requireTenant(req);
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
    // TODO(codex): verify provider signature before trusting the payload.
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

  private ledgerError(err: unknown): ApiResponse {
    if (err instanceof ExecutionError) return { status: 404, body: { error: err.message } };
    return { status: 500, body: { error: err instanceof Error ? err.message : 'error' } };
  }
}
