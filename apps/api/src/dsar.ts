import type { Repository, ContactRow, AgentActionRow, AuditEventRow } from '@cognitia/db';

/**
 * DSAR — data-subject access + erasure (GDPR/CCPA-style), tenant-scoped.
 *
 * EXPORT (right to access): the personal data held about a contact, plus the
 * processing record (governed actions that targeted them) and the audit trail.
 *
 * ERASURE (right to be forgotten): anonymizes the contact's personal data in
 * place (repo.anonymizeContact) and records the erasure as an audit event. The
 * append-only, hash-chained audit trail only ever stored refs/hashes — never
 * raw PII — so erasure removes the personal data while the audit chain stays
 * intact and verifiable, and the action/event history keeps referential meaning.
 *
 * Both operations are owner-only (gated in the handler) and audited.
 */

export class DsarContactNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DsarContactNotFoundError';
  }
}

export interface DsarExport {
  schema_version: 'dsar.v1';
  tenant_id: string;
  contact_id: string;
  generated_at: string;
  generated_by: string;
  /** The personal data held about the subject (PII fields are null once erased). */
  contact: Pick<
    ContactRow,
    | 'id'
    | 'account_id'
    | 'full_name'
    | 'title'
    | 'persona'
    | 'email_hash'
    | 'phone_hash'
    | 'is_suppressed'
    | 'created_at'
    | 'updated_at'
  > & { erased: boolean };
  /** Governed actions that targeted this contact — the processing record. */
  actions: AgentActionRow[];
  /** Audit events recorded against the contact or its actions (oldest first). */
  audit_trail: AuditEventRow[];
}

const byOccurredAsc = (a: AuditEventRow, b: AuditEventRow): number =>
  a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0;

export async function buildDsarExport(
  repo: Repository,
  tenantId: string,
  contactId: string,
  opts: { generatedBy: string; now?: string },
): Promise<DsarExport> {
  const contact = await repo.getContact(tenantId, contactId);
  if (!contact) throw new DsarContactNotFoundError(`contact ${contactId} not found`);

  const contactRef = `contact:${contactId}`;
  const actions = (await repo.listAgentActions(tenantId))
    .filter((a) => a.target_ref === contactRef)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const actionRefs = new Set(actions.map((a) => `agent_action:${a.id}`));
  const audit_trail = (await repo.listAuditEvents(tenantId))
    .filter((e) => actionRefs.has(e.subject_ref) || e.subject_ref === contactRef)
    .sort(byOccurredAsc);

  return {
    schema_version: 'dsar.v1',
    tenant_id: tenantId,
    contact_id: contactId,
    generated_at: opts.now ?? new Date().toISOString(),
    generated_by: opts.generatedBy,
    contact: {
      id: contact.id,
      account_id: contact.account_id,
      full_name: contact.full_name,
      title: contact.title,
      persona: contact.persona,
      email_hash: contact.email_hash,
      phone_hash: contact.phone_hash,
      is_suppressed: contact.is_suppressed,
      created_at: contact.created_at,
      updated_at: contact.updated_at,
      erased: contact.attributes?.erased === true,
    },
    actions,
    audit_trail,
  };
}

export interface DsarErasureResult {
  schema_version: 'dsar.v1';
  tenant_id: string;
  contact_id: string;
  erased_at: string;
  erased_by: string;
  /** `already_erased` when the contact's PII was previously anonymized (idempotent). */
  status: 'erased' | 'already_erased';
}

export async function eraseContactData(
  repo: Repository,
  tenantId: string,
  contactId: string,
  opts: { erasedBy: string; now?: string },
): Promise<DsarErasureResult> {
  const now = opts.now ?? new Date().toISOString();
  const before = await repo.getContact(tenantId, contactId);
  if (!before) throw new DsarContactNotFoundError(`contact ${contactId} not found`);
  const alreadyErased = before.attributes?.erased === true;

  const erased = await repo.anonymizeContact(tenantId, contactId, now);
  if (!erased) throw new DsarContactNotFoundError(`contact ${contactId} not found`);

  return {
    schema_version: 'dsar.v1',
    tenant_id: tenantId,
    contact_id: contactId,
    erased_at: now,
    erased_by: opts.erasedBy,
    status: alreadyErased ? 'already_erased' : 'erased',
  };
}
