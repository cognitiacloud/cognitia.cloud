import { piiHash, type ActionProvenance } from '@cognitia/core';
import type {
  HubspotClient,
  HubspotCompany,
  HubspotContact,
  HubspotDeal,
  HubspotPage,
  HubspotWriteInput,
  HubspotWriteResult,
} from './client.js';

/**
 * Production HubSpot client (CRM v3 REST). Dependency-free: HTTP and the OAuth
 * token source are injected so it is fully unit-testable without network.
 *
 * Responsibilities:
 *  - OAuth: a TokenProvider supplies a fresh access token per tenant (refresh is
 *    handled by the provider; this client never stores or logs raw tokens).
 *  - Cursor pagination for companies/contacts/deals (`paging.next.after`).
 *  - Rate-limit-friendly: honors `Retry-After` and retries 429/5xx with capped
 *    exponential backoff + jitter.
 *  - PII-safe: contact emails are hashed (`piiHash`) before leaving this client.
 */

/** Minimal fetch surface so we don't depend on a DOM lib. */
export interface HttpResponse {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}
export interface HttpRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}
export type HttpFetch = (url: string, init?: HttpRequestInit) => Promise<HttpResponse>;

/** Supplies a valid OAuth access token for a tenant (handles refresh upstream). */
export interface TokenProvider {
  getAccessToken(tenantId: string): Promise<string>;
}

export interface HttpHubspotClientOptions {
  token: TokenProvider;
  fetch?: HttpFetch;
  baseUrl?: string;
  /** Max retry attempts for 429/5xx. Default 5. */
  maxRetries?: number;
  /** Injected sleep so tests don't actually wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Page size for list endpoints. Default 100 (HubSpot max). */
  pageLimit?: number;
  /** Custom property used to dedupe engagement writes. */
  idempotencyProperty?: string;
}

interface HubspotListResponse {
  results: Array<{ id: string; properties?: Record<string, unknown>; associations?: unknown }>;
  paging?: { next?: { after?: string } };
}

const DEFAULT_BASE = 'https://api.hubapi.com';

export class HttpHubspotClient implements HubspotClient {
  private readonly fetch: HttpFetch;
  private readonly base: string;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pageLimit: number;
  private readonly idemProp: string;

  constructor(private readonly opts: HttpHubspotClientOptions) {
    this.fetch = opts.fetch ?? (globalThis as { fetch?: HttpFetch }).fetch!;
    this.base = opts.baseUrl ?? DEFAULT_BASE;
    this.maxRetries = opts.maxRetries ?? 5;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.pageLimit = opts.pageLimit ?? 100;
    this.idemProp = opts.idempotencyProperty ?? 'cognitia_idempotency_key';
  }

  // --- reads (sync) ---

  async listCompanies(input: {
    tenantId: string;
    cursor?: string;
  }): Promise<HubspotPage<HubspotCompany>> {
    const data = await this.list(input.tenantId, 'companies', input.cursor, [
      'name',
      'domain',
      'industry',
      'numberofemployees',
    ]);
    return {
      items: data.results.map((r) => ({
        externalId: r.id,
        name: str(r.properties?.['name']),
        domain: str(r.properties?.['domain']),
        industry: str(r.properties?.['industry']),
        employeeCount: num(r.properties?.['numberofemployees']),
      })),
      cursor: data.paging?.next?.after,
    };
  }

  async listContacts(input: {
    tenantId: string;
    cursor?: string;
  }): Promise<HubspotPage<HubspotContact>> {
    const data = await this.list(
      input.tenantId,
      'contacts',
      input.cursor,
      ['firstname', 'lastname', 'jobtitle', 'email', 'associatedcompanyid'],
      'companies',
    );
    return {
      items: data.results.map((r) => {
        const email = str(r.properties?.['email']);
        return {
          externalId: r.id,
          companyExternalId: this.firstAssociation(r) ?? str(r.properties?.['associatedcompanyid']),
          fullName: joinName(r.properties?.['firstname'], r.properties?.['lastname']),
          title: str(r.properties?.['jobtitle']),
          // PII-safe: hash the email before it leaves the client.
          emailHash: email ? piiHash(email) : undefined,
        };
      }),
      cursor: data.paging?.next?.after,
    };
  }

  async listDeals(input: { tenantId: string; cursor?: string }): Promise<HubspotPage<HubspotDeal>> {
    const data = await this.list(
      input.tenantId,
      'deals',
      input.cursor,
      ['dealname', 'dealstage', 'amount', 'hubspot_owner_id'],
      'companies',
    );
    return {
      items: data.results.map((r) => ({
        externalId: r.id,
        companyExternalId: this.firstAssociation(r),
        name: str(r.properties?.['dealname']),
        stage: str(r.properties?.['dealstage']),
        amount: num(r.properties?.['amount']),
        ownerRef: str(r.properties?.['hubspot_owner_id']),
      })),
      cursor: data.paging?.next?.after,
    };
  }

  // --- writes (idempotent via a dedupe property + search) ---

  createTask(input: HubspotWriteInput): Promise<HubspotWriteResult> {
    return this.upsertEngagement('tasks', input);
  }
  createNote(input: HubspotWriteInput): Promise<HubspotWriteResult> {
    return this.upsertEngagement('notes', input);
  }

  // --- internals ---

  private async list(
    tenantId: string,
    object: string,
    cursor: string | undefined,
    properties: string[],
    associations?: string,
  ): Promise<HubspotListResponse> {
    const params = new URLSearchParams({ limit: String(this.pageLimit) });
    params.set('properties', properties.join(','));
    if (associations) params.set('associations', associations);
    if (cursor) params.set('after', cursor);
    const res = await this.request(
      tenantId,
      'GET',
      `/crm/v3/objects/${object}?${params.toString()}`,
    );
    return (await res.json()) as HubspotListResponse;
  }

  private async upsertEngagement(
    object: string,
    input: HubspotWriteInput,
  ): Promise<HubspotWriteResult> {
    // Idempotency: look for an existing object tagged with this idempotency key.
    const existing = await this.searchByIdempotencyKey(
      input.tenantId,
      object,
      input.idempotencyKey,
    );
    if (existing) {
      return { externalRef: `hubspot:${object}:${existing}`, idempotentReplay: true };
    }
    const body = JSON.stringify({
      properties: {
        ...input.payload,
        [this.idemProp]: input.idempotencyKey,
        ...provenanceProperties(input.provenance),
      },
    });
    const res = await this.request(input.tenantId, 'POST', `/crm/v3/objects/${object}`, body);
    const created = (await res.json()) as { id: string };
    return { externalRef: `hubspot:${object}:${created.id}`, idempotentReplay: false };
  }

  private async searchByIdempotencyKey(
    tenantId: string,
    object: string,
    key: string,
  ): Promise<string | null> {
    const body = JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: this.idemProp, operator: 'EQ', value: key }] }],
      limit: 1,
    });
    const res = await this.request(tenantId, 'POST', `/crm/v3/objects/${object}/search`, body);
    const data = (await res.json()) as { results?: Array<{ id: string }> };
    return data.results?.[0]?.id ?? null;
  }

  private firstAssociation(r: { associations?: unknown }): string | undefined {
    const assoc = r.associations as
      | { companies?: { results?: Array<{ id?: string }> } }
      | undefined;
    return assoc?.companies?.results?.[0]?.id;
  }

  /** Authenticated request with rate-limit-aware retry. */
  private async request(
    tenantId: string,
    method: string,
    path: string,
    body?: string,
  ): Promise<HttpResponse> {
    const token = await this.opts.token.getAccessToken(tenantId);
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await this.fetch(`${this.base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body,
      });
      if (res.status !== 429 && res.status < 500) {
        if (res.status >= 400) {
          throw new HubspotApiError(res.status, await safeText(res));
        }
        return res;
      }
      if (attempt >= this.maxRetries) {
        throw new HubspotApiError(res.status, `exhausted retries after ${attempt} attempts`);
      }
      await this.sleep(this.backoffMs(res, attempt));
      attempt++;
    }
  }

  /** Honor Retry-After (seconds); otherwise capped exponential backoff + jitter. */
  private backoffMs(res: HttpResponse, attempt: number): number {
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) {
      const secs = Number(retryAfter);
      if (Number.isFinite(secs)) return Math.min(secs * 1000, 60_000);
    }
    const base = Math.min(2 ** attempt * 500, 30_000);
    return base + Math.floor(Math.random() * 250);
  }
}

export class HubspotApiError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`hubspot api error ${status}: ${detail}`);
    this.name = 'HubspotApiError';
  }
}

/**
 * Namespaced HubSpot custom properties carrying execution lineage (PROV-1).
 * These must exist on Tasks and Notes in the portal (see hubspot-onboarding.md);
 * missing properties cause HubSpot to reject the write, so onboarding documents
 * them as required. Keep this list and the runbook in sync.
 */
export const PROVENANCE_PROPERTIES = {
  agent: 'cognitia_agent',
  agentRunId: 'cognitia_agent_run_id',
  agentActionId: 'cognitia_agent_action_id',
  evidenceCount: 'cognitia_evidence_count',
  riskLevel: 'cognitia_risk_level',
  approvedBy: 'cognitia_approved_by',
} as const;

/** Map a provenance object to HubSpot property values (refs/roles only, no PII). */
function provenanceProperties(p: ActionProvenance | undefined): Record<string, string | number> {
  if (!p) return {};
  const props: Record<string, string | number> = {
    [PROVENANCE_PROPERTIES.agent]: p.agent,
    [PROVENANCE_PROPERTIES.agentRunId]: p.agent_run_id,
    [PROVENANCE_PROPERTIES.agentActionId]: p.agent_action_id,
    [PROVENANCE_PROPERTIES.evidenceCount]: p.evidence_count,
    [PROVENANCE_PROPERTIES.riskLevel]: p.risk_level,
  };
  if (p.approved_by) props[PROVENANCE_PROPERTIES.approvedBy] = p.approved_by;
  return props;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function joinName(first: unknown, last: unknown): string | undefined {
  const parts = [str(first), str(last)].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}
async function safeText(res: HttpResponse): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
}
