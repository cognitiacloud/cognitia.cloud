import type { IsoTimestamp } from '@cognitia/core';

/**
 * CRM-lite timeline (B3) — a MOCK / SANDBOX operator-console read model.
 *
 * An append-only, in-memory log of {@link TimelineEvent}s that give Alta-style
 * "what happened to this prospect, and when" CRM visibility WITHOUT any real
 * CRM, vendor SDK, network, or database. It records the lifecycle phases the
 * Sales Closer workflow already walks (compliance / approval / appointment /
 * CRM writeback / proof) plus a generic catch-all, and exposes them as an
 * ordered, stable read model suitable for an operator console.
 *
 * HARD RULES (mirrors the platform PII doctrine):
 *   - NO raw PII is ever stored. Events carry ids/refs and non-PII attributes
 *     only. There is no `email`/`phone` field. A redacted/masked form
 *     (e.g. "j***@dealer.example") MAY appear in `summary`, but raw,
 *     real-looking contact values must NOT — {@link assertNoRawPii} enforces
 *     this defensively at write time.
 *   - Pure functions; `now`/`newId` are injected for determinism.
 */

/** The lifecycle phase a timeline event belongs to. */
export type TimelineEventKind =
  | 'compliance'
  | 'approval'
  | 'appointment'
  | 'crm_writeback'
  | 'proof'
  | 'note';

/** Outcome classification, kept coarse and console-friendly. */
export type TimelineOutcome = 'pass' | 'approved' | 'rejected' | 'blocked' | 'ok' | 'pending' | 'info';

/** Sandbox/mock labelling — nothing here is a production CRM record. */
export type TimelineEnvironment = 'MOCK' | 'SANDBOX';

/** An append-only operator-console event. Carries refs/ids only — never raw PII. */
export interface TimelineEvent {
  id: string;
  /** Stable per-tenant workspace scope. */
  workspaceId: string;
  /** The GTM prospect this event is about (an id, never a contact value). */
  prospectId: string;
  kind: TimelineEventKind;
  outcome: TimelineOutcome;
  /** Human-readable, PII-safe one-liner for the console. */
  summary: string;
  /** When the event occurred (ISO-8601). Sort key. */
  at: IsoTimestamp;
  /** Monotonic insertion sequence — stable tiebreaker for equal `at`. */
  seq: number;
  /** Optional non-PII references (appointmentRef, crmRecordRef, approvalRef, …). */
  refs?: Readonly<Record<string, string | null>>;
  /** Always MOCK/SANDBOX — never a production claim. */
  environment: TimelineEnvironment;
}

export interface RecordTimelineEventInput {
  workspaceId: string;
  prospectId: string;
  kind: TimelineEventKind;
  outcome: TimelineOutcome;
  summary: string;
  refs?: Record<string, string | null>;
  /** Defaults to 'MOCK'. */
  environment?: TimelineEnvironment;
}

export interface TimelineDeps {
  now?: () => Date;
  newId?: () => string;
}

/**
 * Defensive PII guard. Rejects values that look like a raw email or phone.
 * Synthetic, clearly-fake forms are allowed:
 *   - emails ending in a reserved TLD (`.example` / `.test` / `.invalid`);
 *   - `555-01xx` style reserved phone numbers;
 *   - already-redacted/masked strings containing `*`.
 * Throws on a real-looking email/phone so raw PII can never enter the timeline.
 */
export function assertNoRawPii(value: string): void {
  // Masked/redacted forms are fine (contain a redaction marker).
  const masked = value.includes('*');

  // Email-shaped tokens.
  const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  for (const match of value.match(emailRe) ?? []) {
    if (masked && match.includes('*')) continue;
    const lower = match.toLowerCase();
    const allowed = lower.endsWith('.example') || lower.endsWith('.test') || lower.endsWith('.invalid');
    if (!allowed) {
      throw new Error(`timeline: refusing to store raw-looking email PII: "${match}"`);
    }
  }

  // Strip ISO-8601 timestamps/dates first — their digit runs are not phone numbers.
  const withoutIso = value.replace(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?/g, ' ');

  // Phone-shaped tokens: 7+ digits separated by phone punctuation (space/dash/dot/parens)
  // or a leading `+`. A bare run of digits with no separators is treated as an opaque id.
  const phoneRe = /(?:\+\d[\d\s().-]{5,}\d|\d{2,}[\s().-]+[\d\s().-]*\d)/g;
  for (const rawMatch of withoutIso.match(phoneRe) ?? []) {
    const digits = rawMatch.replace(/\D/g, '');
    if (digits.length < 7) continue;
    // Allow the reserved fictional 555-01xx exchange (with or without area code).
    const reserved = /55501\d{2}$/.test(digits);
    if (!reserved) {
      throw new Error(`timeline: refusing to store raw-looking phone PII: "${rawMatch.trim()}"`);
    }
  }
}

/**
 * In-memory, append-only timeline. Idempotent reads; writes are pure given
 * injected `now`/`newId`. Not a database — state lives only in the instance.
 */
export class CrmTimeline {
  private readonly events: TimelineEvent[] = [];
  private readonly now: () => Date;
  private readonly newId: () => string;
  private seqCounter = 0;

  constructor(deps: TimelineDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    let auto = 0;
    this.newId = deps.newId ?? (() => `tl_${(++auto).toString(36)}`);
  }

  /** Record one PII-safe event. Returns the stored event (with id/seq/at filled). */
  record(input: RecordTimelineEventInput): TimelineEvent {
    assertNoRawPii(input.summary);
    if (input.refs) {
      for (const v of Object.values(input.refs)) {
        if (typeof v === 'string') assertNoRawPii(v);
      }
    }

    const event: TimelineEvent = {
      id: this.newId(),
      workspaceId: input.workspaceId,
      prospectId: input.prospectId,
      kind: input.kind,
      outcome: input.outcome,
      summary: input.summary,
      at: this.now().toISOString(),
      seq: this.seqCounter++,
      refs: input.refs ? Object.freeze({ ...input.refs }) : undefined,
      environment: input.environment ?? 'MOCK',
    };
    this.events.push(event);
    return event;
  }

  /**
   * Ordered read model for the operator console: sorted by `at` ascending, with
   * insertion `seq` as a stable tiebreaker (so equal timestamps keep their
   * record order). Returns a fresh array; callers cannot mutate internal state.
   */
  read(filter?: { workspaceId?: string; prospectId?: string }): TimelineEvent[] {
    const out = this.events.filter((e) => {
      if (filter?.workspaceId && e.workspaceId !== filter.workspaceId) return false;
      if (filter?.prospectId && e.prospectId !== filter.prospectId) return false;
      return true;
    });
    return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.seq - b.seq));
  }

  /** Total number of recorded events (across all workspaces). */
  size(): number {
    return this.events.length;
  }
}

export function createCrmTimeline(deps: TimelineDeps = {}): CrmTimeline {
  return new CrmTimeline(deps);
}
