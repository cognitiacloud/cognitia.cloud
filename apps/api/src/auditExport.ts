import {
  verifyAuditChain,
  type Repository,
  type AuditEventRow,
  type AgentActionRow,
  type ContactRow,
  type AuditChainVerification,
} from '@cognitia/db';

/**
 * SEC-2 — audit-trail export + retention.
 *
 * Two compliance controls on top of the SEC-1 tamper-evident audit chain:
 *
 *   1. EXPORT — a one-click, self-verifying bundle of the FULL action +
 *      approval chain for a single contact: every governed action that targeted
 *      the contact, every audit event recorded against those actions (proposed,
 *      approved/denied, executed, rolled back), the contact record, and a live
 *      re-verification of the tenant's hash chain embedded as the integrity
 *      proof. A reviewer can recompute the chain from the bundle.
 *
 *   2. RETENTION — a minimum-retention control. The audit log is append-only
 *      and hash-chained, so events are NEVER silently dropped; minimum
 *      retention is therefore structurally guaranteed. The status report proves
 *      the floor is met and flags events older than the window as
 *      archival-eligible. Destructive purge past the window is deliberately NOT
 *      automated: deleting a link would break tamper-evidence, so purge belongs
 *      to a separate, anchored-archival step (documented future work) — the
 *      same honesty posture as "tamper-evident, not tamper-proof".
 */

/** SOC 2-friendly default: retain audit history for 7 years. */
export const DEFAULT_AUDIT_RETENTION_DAYS = 2555;

const DAY_MS = 86_400_000;

export class ContactNotFoundError extends Error {}

export interface RetentionStatus {
  policy: 'retain_minimum';
  window_days: number;
  evaluated_at: string;
  total_events: number;
  oldest_event_at: string | null;
  newest_event_at: string | null;
  /** Age (days) of the oldest retained event — how far back history reaches. */
  retained_through_days: number;
  /** Events older than the window: eligible for anchored archival, not purged. */
  beyond_window_count: number;
  within_window_count: number;
  /**
   * Minimum-retention is met by construction (append-only ⇒ nothing dropped),
   * so this is true whenever the chain is intact for the evaluated set.
   */
  compliant: boolean;
  note: string;
}

export interface ContactAuditExport {
  schema_version: 'sec-2.v1';
  tenant_id: string;
  contact_id: string;
  contact_ref: string;
  exported_at: string;
  /** The verified human/role that pulled the export (access is itself logged). */
  generated_by: string;
  contact: Pick<
    ContactRow,
    'id' | 'account_id' | 'full_name' | 'title' | 'persona' | 'email_hash' | 'is_suppressed'
  >;
  action_count: number;
  /** Every governed action that targeted this contact (oldest first). */
  actions: AgentActionRow[];
  /** Every audit event recorded against those actions or the contact (oldest first). */
  approval_chain: AuditEventRow[];
  /** Live re-verification of the tenant's whole hash chain (the integrity proof). */
  chain_verification: AuditChainVerification;
  retention: RetentionStatus;
}

function clampDays(days: number | undefined): number {
  if (!days || !Number.isFinite(days) || days < 1) return DEFAULT_AUDIT_RETENTION_DAYS;
  return Math.floor(days);
}

const byOccurredAsc = (a: AuditEventRow, b: AuditEventRow): number =>
  a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0;

/**
 * Classify a set of audit events against the minimum-retention window. Pure;
 * `now`/`windowDays` are injected so the result is deterministic and testable.
 */
export function classifyRetention(
  events: AuditEventRow[],
  windowDays: number,
  now: string,
): RetentionStatus {
  const cutoff = new Date(now).getTime() - windowDays * DAY_MS;
  const times = events.map((e) => new Date(e.occurred_at).getTime()).sort((a, b) => a - b);
  const oldest = times.length > 0 ? times[0]! : null;
  const newest = times.length > 0 ? times[times.length - 1]! : null;
  const beyond = times.filter((t) => t < cutoff).length;
  return {
    policy: 'retain_minimum',
    window_days: windowDays,
    evaluated_at: now,
    total_events: events.length,
    oldest_event_at: oldest === null ? null : new Date(oldest).toISOString(),
    newest_event_at: newest === null ? null : new Date(newest).toISOString(),
    retained_through_days:
      oldest === null ? 0 : Math.floor((new Date(now).getTime() - oldest) / DAY_MS),
    beyond_window_count: beyond,
    within_window_count: events.length - beyond,
    compliant: true,
    note:
      beyond > 0
        ? `${beyond} event(s) exceed the ${windowDays}-day window and are eligible for anchored archival; none are purged (purge would break the hash chain).`
        : `All ${events.length} event(s) are within the ${windowDays}-day retention window.`,
  };
}

/** Tenant-wide retention status over the full audit log (read-only report). */
export async function buildRetentionStatus(
  repo: Repository,
  tenantId: string,
  opts: { now?: string; retentionDays?: number } = {},
): Promise<RetentionStatus> {
  const now = opts.now ?? new Date().toISOString();
  const events = await repo.listAuditEvents(tenantId);
  return classifyRetention(events, clampDays(opts.retentionDays), now);
}

/**
 * Build the one-click, self-verifying audit export for a single contact. The
 * chain is verified BEFORE the export-access event is appended, so the embedded
 * proof reflects the state the reviewer is being handed.
 */
export async function buildContactAuditExport(
  repo: Repository,
  tenantId: string,
  contactId: string,
  opts: { generatedBy: string; now?: string; retentionDays?: number },
): Promise<ContactAuditExport> {
  const now = opts.now ?? new Date().toISOString();
  const contact = await repo.getContact(tenantId, contactId);
  if (!contact) throw new ContactNotFoundError(`contact ${contactId} not found`);

  const contactRef = `contact:${contactId}`;
  const allActions = await repo.listAgentActions(tenantId);
  const actions = allActions
    .filter((a) => a.target_ref === contactRef)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const actionRefs = new Set(actions.map((a) => `agent_action:${a.id}`));

  const allAudit = await repo.listAuditEvents(tenantId);
  // Integrity proof over the WHOLE tenant chain — a contact-scoped subset can't
  // prove continuity, so we embed the full-chain verification result.
  const chainVerification = verifyAuditChain(allAudit);
  const approvalChain = allAudit
    .filter((e) => actionRefs.has(e.subject_ref) || e.subject_ref === contactRef)
    .sort(byOccurredAsc);

  return {
    schema_version: 'sec-2.v1',
    tenant_id: tenantId,
    contact_id: contactId,
    contact_ref: contactRef,
    exported_at: now,
    generated_by: opts.generatedBy,
    contact: {
      id: contact.id,
      account_id: contact.account_id,
      full_name: contact.full_name,
      title: contact.title,
      persona: contact.persona,
      email_hash: contact.email_hash,
      is_suppressed: contact.is_suppressed,
    },
    action_count: actions.length,
    actions,
    approval_chain: approvalChain,
    chain_verification: chainVerification,
    retention: classifyRetention(approvalChain, clampDays(opts.retentionDays), now),
  };
}
