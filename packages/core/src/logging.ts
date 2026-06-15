import { createHash } from 'node:crypto';

/** The only fields permitted in a structured log line. */
export interface StructuredLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  trace_id?: string;
  tenant_id?: string;
  agent_run_id?: string;
  agent_action_id?: string;
  entity_ref?: string;
  event_name?: string;
  duration_ms?: number;
}

const ALLOWED_KEYS = new Set<keyof StructuredLog>([
  'level',
  'message',
  'trace_id',
  'tenant_id',
  'agent_run_id',
  'agent_action_id',
  'entity_ref',
  'event_name',
  'duration_ms',
]);

/** Keys that must never appear in a log line (raw PII / secrets). */
const FORBIDDEN_KEY_HINTS = [
  'email',
  'phone',
  'transcript',
  'token',
  'secret',
  'password',
  'authorization',
  'body',
  'message_body',
  'content',
  'api_key',
];

/**
 * Redact an arbitrary log object down to the allowed structured shape. Unknown
 * keys are dropped; forbidden keys are dropped even if they slip into allowed
 * positions. This is the only sanctioned way to emit logs.
 */
export function redactLog(input: Record<string, unknown>): StructuredLog {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEY_HINTS.some((h) => lower.includes(h))) continue;
    if (!ALLOWED_KEYS.has(key as keyof StructuredLog)) continue;
    // Value-level scrub: allowed FREE-TEXT fields (message/entity_ref) could
    // still carry an interpolated email/token. The key allowlist filters key
    // NAMES; this filters VALUES so an accidental interpolation never lands.
    out[key] = typeof value === 'string' ? sanitizeText(value) : value;
  }
  // level/message are required; default sensibly.
  if (typeof out.level !== 'string') out.level = 'info';
  if (typeof out.message !== 'string') out.message = '';
  return out as unknown as StructuredLog;
}

// Bounded quantifiers (real-world email limits) so the matcher is linear — no
// catastrophic backtracking on adversarial input (avoids js/polynomial-redos).
const EMAIL_RE = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
// Long opaque strings (tokens, keys, hashes): base64url/hex of length >= 40.
const LONG_SECRET_RE = /\b[A-Za-z0-9_-]{40,}\b/g;

/**
 * Scrub obvious PII/secret patterns out of a free-text string: email
 * addresses, `Bearer <token>` headers, and long opaque token/key/hash blobs.
 * Conservative by design — it redacts clear matches, not ordinary words.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(BEARER_RE, 'Bearer [redacted]')
    .replace(LONG_SECRET_RE, '[redacted]');
}

/**
 * Turn an unknown error into a bounded, scrubbed string safe to persist (e.g.
 * into an action's `result`) — third-party errors may carry tokens, response
 * bodies, or stack traces. Truncated so a verbose error can't bloat a row.
 */
export function sanitizeErrorText(err: unknown, maxLength = 500): string {
  const raw = err instanceof Error ? err.message : String(err);
  return sanitizeText(raw).slice(0, maxLength);
}

/** Emit a redacted structured JSON log line. */
export function log(input: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(redactLog(input)));
}

/** Hash a PII value (email/phone) for safe reference in events/logs. */
export function piiHash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
