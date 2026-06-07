/**
 * HubSpot client boundary — the single seam where real HubSpot API calls live.
 *
 * This interface is the contract Codex implements (REST v3 + OAuth). Everything
 * above it (adapter, ledger, agents) is already done and tested against the
 * in-memory fake below, so the concrete implementation can be built and verified
 * in isolation without touching agent logic.
 *
 * Invariants the real implementation MUST uphold:
 *   - Writes are idempotent on `idempotencyKey` (use HubSpot's idempotency
 *     support or a dedupe lookup); a replay returns the original `externalRef`.
 *   - Never logs raw PII (emails/tokens); log refs/hashes only.
 *   - Reads return CRM facts (companies/contacts/deals) for SQL upsert; vector
 *     store is never the source of CRM facts.
 */

export interface HubspotWriteInput {
  tenantId: string;
  idempotencyKey: string;
  /** Internal target ref, e.g. "account:uuid" | "contact:uuid". */
  targetRef: string;
  payload: Record<string, unknown>;
}

export interface HubspotWriteResult {
  externalRef: string;
  /** True when the write was collapsed by idempotency (no new side effect). */
  idempotentReplay: boolean;
}

export interface HubspotCompany {
  externalId: string;
  name?: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
}
export interface HubspotContact {
  externalId: string;
  companyExternalId?: string;
  fullName?: string;
  title?: string;
  /** Hash, never raw email. */
  emailHash?: string;
}
export interface HubspotPage<T> {
  items: T[];
  cursor?: string;
}

export interface HubspotClient {
  /** Create a CRM task (engagement). Idempotent on idempotencyKey. */
  createTask(input: HubspotWriteInput): Promise<HubspotWriteResult>;
  /** Create a CRM note (engagement). Idempotent on idempotencyKey. */
  createNote(input: HubspotWriteInput): Promise<HubspotWriteResult>;
  /** Page companies for sync (since cursor / updatedAt). */
  listCompanies(input: { tenantId: string; cursor?: string }): Promise<HubspotPage<HubspotCompany>>;
  /** Page contacts for sync. */
  listContacts(input: { tenantId: string; cursor?: string }): Promise<HubspotPage<HubspotContact>>;
}

/**
 * In-memory fake used by tests and the MVP stub adapter. Mirrors the idempotency
 * contract so behavior matches what the real client must do.
 */
export class FakeHubspotClient implements HubspotClient {
  private readonly writes = new Map<string, HubspotWriteResult>();
  companies: HubspotCompany[] = [];
  contacts: HubspotContact[] = [];

  private write(kind: string, input: HubspotWriteInput): HubspotWriteResult {
    const prior = this.writes.get(input.idempotencyKey);
    if (prior) return { ...prior, idempotentReplay: true };
    const result: HubspotWriteResult = {
      externalRef: `hubspot:${kind}:${input.idempotencyKey.slice(0, 12)}`,
      idempotentReplay: false,
    };
    this.writes.set(input.idempotencyKey, result);
    return result;
  }

  async createTask(input: HubspotWriteInput): Promise<HubspotWriteResult> {
    return this.write('task', input);
  }
  async createNote(input: HubspotWriteInput): Promise<HubspotWriteResult> {
    return this.write('note', input);
  }
  async listCompanies(_input: {
    tenantId: string;
    cursor?: string;
  }): Promise<HubspotPage<HubspotCompany>> {
    return { items: this.companies };
  }
  async listContacts(_input: {
    tenantId: string;
    cursor?: string;
  }): Promise<HubspotPage<HubspotContact>> {
    return { items: this.contacts };
  }
}
