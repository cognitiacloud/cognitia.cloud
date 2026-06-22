import type { IsoTimestamp } from '@cognitia/core';
import { assertNoRawPii, CrmTimeline, type TimelineEvent } from './timeline.js';

/**
 * CRM-lite (B3) — a MOCK / SANDBOX in-memory "CRM" giving Alta-style CRM
 * visibility WITHOUT any real CRM, vendor SDK, network, or database.
 *
 * It models the minimal CRM entity graph — {@link Company}, {@link Contact},
 * {@link Opportunity} — plus an embedded {@link CrmTimeline}, and exposes
 * idempotent `upsert*` writes. Idempotency is keyed by a deterministic
 * composite key (`workspaceId + prospectId [+ appointmentRef]`): upserting the
 * same key twice updates in place and returns the SAME record id — never a
 * duplicate.
 *
 * HARD RULES:
 *   - NO raw PII. Contacts carry a `companyName`, a non-PII `role`, and (only if
 *     truly needed) an `emailExample` that MUST use a reserved `.example` TLD.
 *     There are no raw email/phone fields. {@link assertNoRawPii} guards writes.
 *   - Pure given injected `now`/`newId`; state lives only in the instance.
 *   - Tenant scope: Budget Wheels demo is `budget_wheels_demo` / Tenant Zero.
 */

export interface Company {
  id: string;
  workspaceId: string;
  companyName: string;
  /** Non-PII business attributes only (region, businessType, website host, …). */
  attributes: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface Contact {
  id: string;
  workspaceId: string;
  /** The originating GTM prospect id — the idempotency anchor. */
  prospectId: string;
  companyId: string;
  /** Non-PII role label, e.g. "General Manager". Never a person's raw name. */
  role: string | null;
  /**
   * OPTIONAL synthetic contact email. If present it MUST end in a reserved TLD
   * (`.example`/`.test`/`.invalid`). Never a real address. Guarded on write.
   */
  emailExample: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export type OpportunityStage =
  | 'lead'
  | 'qualified'
  | 'appointment_set'
  | 'proposal'
  | 'won'
  | 'lost';

export interface Opportunity {
  id: string;
  workspaceId: string;
  prospectId: string;
  companyId: string;
  stage: OpportunityStage;
  /** Non-PII appointment reference (opaque id), when an appointment exists. */
  appointmentRef: string | null;
  /** Non-PII CRM writeback reference (opaque id), when written back. */
  crmRecordRef: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface CrmLiteDeps {
  now?: () => Date;
  newId?: () => string;
  /** Optional shared timeline; one is created if omitted. */
  timeline?: CrmTimeline;
}

export interface UpsertCompanyInput {
  workspaceId: string;
  companyName: string;
  attributes?: Record<string, string | number | boolean | null>;
}

export interface UpsertContactInput {
  workspaceId: string;
  prospectId: string;
  companyId: string;
  role?: string | null;
  emailExample?: string | null;
}

export interface UpsertOpportunityInput {
  workspaceId: string;
  prospectId: string;
  companyId: string;
  stage: OpportunityStage;
  appointmentRef?: string | null;
  crmRecordRef?: string | null;
}

/** Build the deterministic idempotency key for a record. */
export function crmIdempotencyKey(
  workspaceId: string,
  prospectId: string,
  appointmentRef?: string | null,
): string {
  return appointmentRef
    ? `${workspaceId}::${prospectId}::${appointmentRef}`
    : `${workspaceId}::${prospectId}`;
}

function assertReservedEmail(email: string): void {
  const lower = email.toLowerCase();
  const ok = lower.endsWith('.example') || lower.endsWith('.test') || lower.endsWith('.invalid');
  if (!ok) {
    throw new Error(
      `crm-lite: contact email must use a reserved TLD (.example/.test/.invalid): "${email}"`,
    );
  }
}

/**
 * In-memory mock CRM. Idempotent `upsert*`; read accessors return copies so
 * callers cannot mutate internal state. Not a database.
 */
export class MockCrmLite {
  private readonly companies = new Map<string, Company>();
  private readonly contacts = new Map<string, Contact>();
  private readonly opportunities = new Map<string, Opportunity>();
  readonly timeline: CrmTimeline;

  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(deps: CrmLiteDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    let auto = 0;
    this.newId = deps.newId ?? (() => `crm_${(++auto).toString(36)}`);
    this.timeline = deps.timeline ?? new CrmTimeline({ now: this.now });
  }

  private nowIso(): IsoTimestamp {
    return this.now().toISOString();
  }

  /** Idempotent company upsert, keyed by workspaceId + companyName. */
  upsertCompany(input: UpsertCompanyInput): Company {
    assertNoRawPii(input.companyName);
    const key = `${input.workspaceId}::${input.companyName}`;
    const existing = this.companies.get(key);
    const attributes = Object.freeze({ ...(input.attributes ?? {}) });
    if (existing) {
      const updated: Company = { ...existing, attributes, updatedAt: this.nowIso() };
      this.companies.set(key, updated);
      return updated;
    }
    const at = this.nowIso();
    const company: Company = {
      id: this.newId(),
      workspaceId: input.workspaceId,
      companyName: input.companyName,
      attributes,
      createdAt: at,
      updatedAt: at,
    };
    this.companies.set(key, company);
    return company;
  }

  /** Idempotent contact upsert, keyed by workspaceId + prospectId. */
  upsertContact(input: UpsertContactInput): Contact {
    if (input.emailExample) {
      assertReservedEmail(input.emailExample);
      assertNoRawPii(input.emailExample);
    }
    if (input.role) assertNoRawPii(input.role);

    const key = crmIdempotencyKey(input.workspaceId, input.prospectId);
    const existing = this.contacts.get(key);
    if (existing) {
      const updated: Contact = {
        ...existing,
        companyId: input.companyId,
        role: input.role ?? existing.role,
        emailExample: input.emailExample ?? existing.emailExample,
        updatedAt: this.nowIso(),
      };
      this.contacts.set(key, updated);
      return updated;
    }
    const at = this.nowIso();
    const contact: Contact = {
      id: this.newId(),
      workspaceId: input.workspaceId,
      prospectId: input.prospectId,
      companyId: input.companyId,
      role: input.role ?? null,
      emailExample: input.emailExample ?? null,
      createdAt: at,
      updatedAt: at,
    };
    this.contacts.set(key, contact);
    return contact;
  }

  /**
   * Idempotent opportunity upsert, keyed by workspaceId + prospectId +
   * appointmentRef. Re-upserting the same key updates stage/refs in place and
   * returns the same record id.
   */
  upsertOpportunity(input: UpsertOpportunityInput): Opportunity {
    const key = crmIdempotencyKey(input.workspaceId, input.prospectId, input.appointmentRef);
    const existing = this.opportunities.get(key);
    if (existing) {
      const updated: Opportunity = {
        ...existing,
        companyId: input.companyId,
        stage: input.stage,
        appointmentRef: input.appointmentRef ?? existing.appointmentRef,
        crmRecordRef: input.crmRecordRef ?? existing.crmRecordRef,
        updatedAt: this.nowIso(),
      };
      this.opportunities.set(key, updated);
      return updated;
    }
    const at = this.nowIso();
    const opportunity: Opportunity = {
      id: this.newId(),
      workspaceId: input.workspaceId,
      prospectId: input.prospectId,
      companyId: input.companyId,
      stage: input.stage,
      appointmentRef: input.appointmentRef ?? null,
      crmRecordRef: input.crmRecordRef ?? null,
      createdAt: at,
      updatedAt: at,
    };
    this.opportunities.set(key, opportunity);
    return opportunity;
  }

  /* ----------------------------------------------------------- read accessors */

  getCompany(workspaceId: string, companyName: string): Company | undefined {
    return this.companies.get(`${workspaceId}::${companyName}`);
  }

  getContact(workspaceId: string, prospectId: string): Contact | undefined {
    return this.contacts.get(crmIdempotencyKey(workspaceId, prospectId));
  }

  getOpportunity(
    workspaceId: string,
    prospectId: string,
    appointmentRef?: string | null,
  ): Opportunity | undefined {
    return this.opportunities.get(crmIdempotencyKey(workspaceId, prospectId, appointmentRef));
  }

  listCompanies(workspaceId?: string): Company[] {
    return [...this.companies.values()].filter(
      (c) => !workspaceId || c.workspaceId === workspaceId,
    );
  }

  listContacts(workspaceId?: string): Contact[] {
    return [...this.contacts.values()].filter((c) => !workspaceId || c.workspaceId === workspaceId);
  }

  listOpportunities(workspaceId?: string): Opportunity[] {
    return [...this.opportunities.values()].filter(
      (o) => !workspaceId || o.workspaceId === workspaceId,
    );
  }

  /** Convenience pass-through to the embedded timeline read model. */
  readTimeline(filter?: { workspaceId?: string; prospectId?: string }): TimelineEvent[] {
    return this.timeline.read(filter);
  }
}

export function createMockCrmLite(deps: CrmLiteDeps = {}): MockCrmLite {
  return new MockCrmLite(deps);
}
