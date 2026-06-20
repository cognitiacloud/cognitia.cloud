import { piiHash } from '@cognitia/core';
import type { ApifyPiiRisk } from './types.js';

/**
 * PII redaction + hashing for Apify ingestion (pure; no env, no I/O).
 *
 * Doctrine: direct contact PII is NEVER persisted. Raw dataset items may carry
 * emails/phones/person names; these keys are stripped before staging, and a
 * final `ensureNoDirectPiiPersisted` guard throws if any survived. Hashes use
 * the platform's deterministic `piiHash` (sha256 of trimmed+lowercased value).
 */

/** Direct-PII keys removed from any persisted payload (case-insensitive). */
export const DIRECT_PII_KEYS = [
  'email',
  'emails',
  'phone',
  'phones',
  'mobile',
  'cell',
  'contactemail',
  'contactphone',
  'fullname',
  'personname',
  'ownername',
  'managername',
] as const;

const DIRECT_PII_SET = new Set<string>(DIRECT_PII_KEYS);

function isPiiKey(key: string): boolean {
  return DIRECT_PII_SET.has(key.toLowerCase());
}

/**
 * Deep-clone `raw` with every direct-PII key removed at any depth. Returns the
 * redacted object and whether anything was stripped. Never mutates the input.
 */
export function redactContactFields(raw: unknown): { redacted: unknown; removed: boolean } {
  let removed = false;
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (isPiiKey(k)) {
          removed = true;
          continue;
        }
        out[k] = walk(v);
      }
      return out;
    }
    return value;
  };
  const redacted = walk(raw);
  return { redacted, removed };
}

/** Normalize a phone to digits only (keeps a leading +), for deterministic hashing. */
export function normalizePhoneToDigits(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/\D/g, '');
}

/** Hash a contact value deterministically. Email/phone normalized first. */
export function hashContactValue(
  value: string,
  kind: 'email' | 'phone' | 'other' = 'other',
): string {
  if (kind === 'phone') return piiHash(normalizePhoneToDigits(value));
  // piiHash already trims + lowercases (correct for email and generic values).
  return piiHash(value);
}

/** Heuristic PII-risk classification of a raw item (for compliance flags). */
export function classifyPiiRisk(raw: unknown): ApifyPiiRisk {
  const json = JSON.stringify(raw ?? {}).toLowerCase();
  const hasEmail =
    /"(email|emails|contactemail)"\s*:/.test(json) || /@[a-z0-9.-]+\.[a-z]{2,}/.test(json);
  const hasPhone = /"(phone|phones|mobile|cell|contactphone)"\s*:/.test(json);
  const hasName = /"(fullname|personname|ownername|managername)"\s*:/.test(json);
  if (hasEmail && (hasPhone || hasName)) return 'high';
  if (hasEmail || hasPhone) return 'medium';
  if (hasName) return 'low';
  return 'none';
}

/**
 * Defense-in-depth guard: throw if a record about to be persisted still carries
 * any direct-PII key. Scans the redacted payload + normalized fields. Error text
 * names only the offending KEY, never the value.
 */
export function ensureNoDirectPiiPersisted(record: { rawRedacted: unknown }): void {
  const offenders: string[] = [];
  const scan = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (isPiiKey(k)) offenders.push(k.toLowerCase());
        else scan(v);
      }
    }
  };
  scan(record.rawRedacted);
  if (offenders.length > 0) {
    throw new Error(
      `direct PII must not be persisted; offending keys: ${[...new Set(offenders)].sort().join(', ')}`,
    );
  }
}
