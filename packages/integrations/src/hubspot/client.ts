import type { ActionProvenance } from '@cognitia/core';
import { REQUIRED_ENGAGEMENT_PROPERTIES } from './writePlan.js';

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
  /**
   * Execution lineage (PROV-1) stamped onto the created CRM object as namespaced
   * `cognitia_*` properties. Never part of idempotency; carries no raw PII.
   */
  provenance?: ActionProvenance;
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
export interface HubspotDeal {
  externalId: string;
  /** External id of the associated company; maps to opportunity.account_id. */
  companyExternalId?: string;
  name?: string;
  stage?: string;
  amount?: number;
  ownerRef?: string;
}
export interface HubspotPage<T> {
  items: T[];
  cursor?: string;
}

export interface HubspotClient {
  /**
   * CGD-001: true/omitted means this client is live (vendor network). Only an
   * explicit false is fixture/local. Fail-close: secrets are not consent.
   */
  readonly liveOutbound?: boolean;
  /** Create a CRM task (engagement). Idempotent on idempotencyKey. */
  createTask(input: HubspotWriteInput): Promise<HubspotWriteResult>;
  /** Create a CRM note (engagement). Idempotent on idempotencyKey. */
  createNote(input: HubspotWriteInput): Promise<HubspotWriteResult>;
  /**
   * UNDO-1: archive (soft-delete) an engagement Cognitia created earlier.
   * Archiving is HubSpot's reversible delete — the object moves to the
   * recycle bin rather than being destroyed. Idempotent: archiving an
   * already-archived object is a no-op.
   */
  archiveEngagement(input: {
    tenantId: string;
    object: 'tasks' | 'notes';
    externalId: string;
  }): Promise<void>;
  /** Page companies for sync (since cursor / updatedAt). */
  listCompanies(input: { tenantId: string; cursor?: string }): Promise<HubspotPage<HubspotCompany>>;
  /** Page contacts for sync. */
  listContacts(input: { tenantId: string; cursor?: string }): Promise<HubspotPage<HubspotContact>>;
  /** Page deals for sync. */
  listDeals(input: { tenantId: string; cursor?: string }): Promise<HubspotPage<HubspotDeal>>;
  /**
   * RDY-1: list the internal names of properties defined on an engagement
   * object type. Used by the connection-readiness gate to verify the required
   * `cognitia_*` custom properties exist BEFORE the first live write (a write
   * to a missing property is rejected by HubSpot).
   */
  listObjectProperties(input: { tenantId: string; object: 'tasks' | 'notes' }): Promise<string[]>;
}

/**
 * In-memory fake used by tests and the MVP stub adapter. Mirrors the idempotency
 * contract so behavior matches what the real client must do.
 */
export class FakeHubspotClient implements HubspotClient {
  readonly liveOutbound = false as const;
  private readonly writes = new Map<string, HubspotWriteResult>();
  companies: HubspotCompany[] = [];
  contacts: HubspotContact[] = [];
  deals: HubspotDeal[] = [];
  /** Append-only log of accepted writes (post-idempotency) for test assertions. */
  readonly writeLog: Array<{ kind: string; input: HubspotWriteInput }> = [];

  private write(kind: string, input: HubspotWriteInput): HubspotWriteResult {
    const prior = this.writes.get(input.idempotencyKey);
    if (prior) return { ...prior, idempotentReplay: true };
    const result: HubspotWriteResult = {
      externalRef: `hubspot:${kind}:${input.idempotencyKey.slice(0, 12)}`,
      idempotentReplay: false,
    };
    this.writes.set(input.idempotencyKey, result);
    this.writeLog.push({ kind, input });
    return result;
  }

  async createTask(input: HubspotWriteInput): Promise<HubspotWriteResult> {
    return this.write('task', input);
  }
  async createNote(input: HubspotWriteInput): Promise<HubspotWriteResult> {
    return this.write('note', input);
  }
  /** Append-only archive log for test assertions (UNDO-1). */
  readonly archiveLog: Array<{ object: string; externalId: string }> = [];
  async archiveEngagement(input: {
    tenantId: string;
    object: 'tasks' | 'notes';
    externalId: string;
  }): Promise<void> {
    // Idempotent like the real API: re-archiving is a no-op.
    if (this.archiveLog.some((a) => a.object === input.object && a.externalId === input.externalId))
      return;
    this.archiveLog.push({ object: input.object, externalId: input.externalId });
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
  async listDeals(_input: {
    tenantId: string;
    cursor?: string;
  }): Promise<HubspotPage<HubspotDeal>> {
    return { items: this.deals };
  }

  /**
   * RDY-1 readiness support. Defaults to "every required property present" so
   * existing tests are unaffected; set `objectProperties` to simulate a
   * misconfigured portal (missing custom properties).
   */
  objectProperties: Record<'tasks' | 'notes', string[]> | null = null;
  async listObjectProperties(input: {
    tenantId: string;
    object: 'tasks' | 'notes';
  }): Promise<string[]> {
    if (this.objectProperties) return this.objectProperties[input.object];
    return [...REQUIRED_ENGAGEMENT_PROPERTIES, 'hs_task_subject', 'hs_note_body', 'hs_timestamp'];
  }
}
