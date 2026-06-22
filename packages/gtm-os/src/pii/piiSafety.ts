import type { FixtureLead } from '../types.js';

/**
 * PII safety primitives. v0 admits ONLY fictional, reserved data:
 *   - emails on the reserved `.example` TLD (RFC 6761), and
 *   - phones in the reserved fictional NANP `555-01xx` range.
 *
 * `scanForRawPii` deep-scans arbitrary values (fixtures, ledger payloads, logs)
 * for anything that looks like *real* contact PII, so the ledger and proof
 * receipts can be proven free of raw PII. Samples in violations are redacted so
 * the scanner's own output never leaks a raw value.
 */

/** Anchored: whole string must be a `*.example` address. */
const SAFE_EMAIL = /^[^\s@]+@[^\s@]+\.example$/i;
/** Anchored: whole string must be a reserved `555-01xx` fictional number. */
const SAFE_PHONE = /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?555[\s.-]?01\d{2}$/;

/** Detection patterns for *disallowed* raw PII (global, for matchAll). */
const RAW_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SSN_LIKE = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE_CANDIDATE = /\+?\d[\d().\s-]{6,}\d/g;

export interface PiiViolation {
  path: string;
  kind: 'email' | 'phone' | 'ssn';
  /** Redacted to first two chars; never the full raw value. */
  sample: string;
}

export function isSafeEmail(value: string): boolean {
  return SAFE_EMAIL.test(value);
}

export function isSafePhone(value: string): boolean {
  return SAFE_PHONE.test(value.trim());
}

function redactSample(value: string): string {
  return `${value.slice(0, 2)}***`;
}

/** Recursively scan any value; return every raw-PII-looking leaf found. */
export function scanForRawPii(value: unknown): PiiViolation[] {
  const out: PiiViolation[] = [];
  walk(value, '$', out);
  return out;
}

function walk(value: unknown, path: string, out: PiiViolation[]): void {
  if (typeof value === 'string') {
    scanString(value, path, out);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`, out));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, `${path}.${key}`, out);
    }
  }
}

function scanString(text: string, path: string, out: PiiViolation[]): void {
  for (const match of text.matchAll(RAW_EMAIL)) {
    const value = match[0];
    if (value === undefined) continue;
    if (!isSafeEmail(value)) out.push({ path, kind: 'email', sample: redactSample(value) });
  }
  for (const match of text.matchAll(SSN_LIKE)) {
    const value = match[0];
    if (value === undefined) continue;
    out.push({ path, kind: 'ssn', sample: redactSample(value) });
  }
  for (const match of text.matchAll(PHONE_CANDIDATE)) {
    const value = match[0];
    if (value === undefined) continue;
    const digits = value.replace(/\D/g, '');
    const hasSeparator = /[\s().-]/.test(value) || value.startsWith('+');
    if ((digits.length === 10 || digits.length === 11) && hasSeparator && !isSafePhone(value)) {
      out.push({ path, kind: 'phone', sample: redactSample(value) });
    }
  }
}

export class PiiViolationError extends Error {
  readonly violations: PiiViolation[];
  constructor(violations: PiiViolation[]) {
    super(`raw PII detected (${violations.length} violation(s)); refusing to proceed`);
    this.name = 'PiiViolationError';
    this.violations = violations;
  }
}

/** Throw unless every contact field on the lead uses the reserved safe forms. */
export function assertLeadPiiSafe(lead: FixtureLead): void {
  const violations = scanForRawPii({
    displayName: lead.displayName,
    source: lead.source,
  });
  if (!isSafeEmail(lead.email)) {
    violations.push({ path: '$.email', kind: 'email', sample: redactSample(lead.email) });
  }
  if (!isSafePhone(lead.phone)) {
    violations.push({ path: '$.phone', kind: 'phone', sample: redactSample(lead.phone) });
  }
  if (violations.length > 0) throw new PiiViolationError(violations);
}
