/**
 * Audit event schema (mock-safe, dependency-free).
 *
 * Mirrors the canonical event envelope convention
 * (packages/core/src/schemas/event.ts):
 *   - event_name is `domain.entity.action.vN`;
 *   - payloads carry references and hashes, NEVER raw PII;
 *   - every event is tenant-scoped and trace-correlated.
 *
 * This module avoids a zod dependency so it type-checks and tests with the
 * native Node toolchain (no install / no network). When folded into the
 * canonical packages/core, prefer the zod schemas there and keep this as the
 * reference contract + the enterprise event registry.
 */

/** Enterprise/governance audit event names (`domain.entity.action.vN`). */
export const AUDIT_EVENT_NAMES = [
  'authz.access.denied.v1',
  'authz.access.granted.v1',
  'authz.role.changed.v1',
  'connector.darkmode.enforced.v1',
  'connector.config.changed.v1',
  'release.gate.evaluated.v1',
  'release.gate.overridden.v1',
  'action.dryrun.recorded.v1',
  'action.live.blocked.v1',
  'incident.declared.v1',
  'incident.resolved.v1',
  'rollback.executed.v1',
  'approval.founder.recorded.v1',
  'approval.legal.recorded.v1',
] as const;
export type AuditEventName = (typeof AUDIT_EVENT_NAMES)[number];

const EVENT_NAME_RE = /^[a-z]+\.[a-z_]+\.[a-z_]+\.v\d+$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The envelope every audit event shares. */
export interface AuditEvent {
  readonly id: string; // uuid
  readonly tenant_id: string; // uuid
  readonly event_name: AuditEventName;
  readonly entity_type: string;
  readonly entity_id: string; // uuid
  readonly actor_ref: string; // "user:<uuid>" | "agent:<id>" | "system" — never a name/email
  readonly source: string;
  readonly occurred_at: string; // iso
  readonly trace_id: string;
  /** References and hashes only. Validated by {@link assertNoRawPii}. */
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Patterns that indicate raw PII leaking into a payload value. */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s().-]?){10,}/;
/** Keys we never accept verbatim — they must be hashed/ref'd instead. */
const FORBIDDEN_PII_KEYS = new Set([
  'email',
  'phone',
  'first_name',
  'last_name',
  'full_name',
  'address',
  'ssn',
]);

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/**
 * Reject raw PII anywhere in a payload. A value fails if a forbidden key is
 * present, or any string value looks like an email or phone number. Hashes
 * ("sha256:…") and refs ("contact:<uuid>") are allowed.
 */
export function assertNoRawPii(payload: Readonly<Record<string, unknown>>): ValidationResult {
  const errors: string[] = [];

  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (value.startsWith('sha256:') || value.startsWith('hash:')) return; // hashed ref ok
      if (EMAIL_RE.test(value)) errors.push(`raw_email_at:${path}`);
      if (PHONE_RE.test(value)) errors.push(`raw_phone_at:${path}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (FORBIDDEN_PII_KEYS.has(k.toLowerCase())) errors.push(`forbidden_pii_key:${path}.${k}`);
        visit(v, `${path}.${k}`);
      }
    }
  };

  visit(payload, '$');
  return { ok: errors.length === 0, errors };
}

/** Full validation of an audit event envelope (shape + mock-safe invariants). */
export function validateAuditEvent(input: unknown): ValidationResult {
  const errors: string[] = [];
  const e = input as Partial<AuditEvent>;

  if (!isUuid(e.id)) errors.push('id_must_be_uuid');
  if (!isUuid(e.tenant_id)) errors.push('tenant_id_must_be_uuid');
  if (!isUuid(e.entity_id)) errors.push('entity_id_must_be_uuid');
  if (typeof e.event_name !== 'string' || !EVENT_NAME_RE.test(e.event_name)) {
    errors.push('event_name_must_be_domain.entity.action.vN');
  } else if (!(AUDIT_EVENT_NAMES as readonly string[]).includes(e.event_name)) {
    errors.push(`event_name_not_registered:${e.event_name}`);
  }
  if (typeof e.entity_type !== 'string' || e.entity_type.length === 0) {
    errors.push('entity_type_required');
  }
  if (typeof e.actor_ref !== 'string' || EMAIL_RE.test(e.actor_ref)) {
    errors.push('actor_ref_required_and_non_pii');
  }
  if (typeof e.source !== 'string' || e.source.length === 0) errors.push('source_required');
  if (typeof e.trace_id !== 'string' || e.trace_id.length === 0) errors.push('trace_id_required');
  if (typeof e.occurred_at !== 'string' || !ISO_RE.test(e.occurred_at)) {
    errors.push('occurred_at_must_be_iso8601');
  }
  if (e.payload == null || typeof e.payload !== 'object' || Array.isArray(e.payload)) {
    errors.push('payload_must_be_object');
  } else {
    const pii = assertNoRawPii(e.payload as Record<string, unknown>);
    errors.push(...pii.errors);
  }

  return { ok: errors.length === 0, errors };
}
