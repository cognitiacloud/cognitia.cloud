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
    out[key] = value;
  }
  // level/message are required; default sensibly.
  if (typeof out.level !== 'string') out.level = 'info';
  if (typeof out.message !== 'string') out.message = '';
  return out as unknown as StructuredLog;
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
