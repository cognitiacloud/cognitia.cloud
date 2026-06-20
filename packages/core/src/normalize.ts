import { createHash } from 'node:crypto';
import type { ApifyDatasetItem } from '@cognitia/apify';

/**
 * Canonicalize a company domain from a website URL, raw domain, or email.
 * Lowercases, strips protocol / `www.` / path, and trims trailing dots.
 */
export function canonicalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  if (s.includes('@')) s = s.split('@')[1] ?? s;
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0] ?? s;
  s = s.split('?')[0] ?? s;
  return s.replace(/\.+$/, '');
}

/** Stable dedupe key for an account (the canonical domain). */
export function accountDedupeKey(domain: string): string {
  return canonicalizeDomain(domain);
}

/** Stable dedupe key for a contact within an account. */
export function contactDedupeKey(opts: { email?: string; fullName?: string }): string {
  if (opts.email) return opts.email.trim().toLowerCase();
  return (opts.fullName ?? 'unknown').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface NormalizedRecord {
  domain: string;
  account: {
    domain: string;
    displayName: string;
    industry?: string;
    employeeRange?: string;
    country?: string;
    hqCity?: string;
    linkedinUrl?: string;
    dedupeKey: string;
  };
  contact?: {
    fullName: string;
    title?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    dedupeKey: string;
  };
}

/** Pure transform: raw Apify item -> normalized account/contact (no DB). */
export function normalizeItem(item: ApifyDatasetItem): NormalizedRecord | null {
  const rawDomain = item.domain ?? item.website ?? item.contactEmail;
  if (!rawDomain) return null;
  const domain = canonicalizeDomain(String(rawDomain));
  if (!domain) return null;

  const record: NormalizedRecord = {
    domain,
    account: {
      domain,
      displayName: item.companyName?.trim() || domain,
      industry: item.industry,
      employeeRange: item.size,
      country: item.country,
      hqCity: item.city,
      linkedinUrl: item.linkedinUrl,
      dedupeKey: accountDedupeKey(domain),
    },
  };

  if (item.contactName || item.contactEmail) {
    record.contact = {
      fullName: item.contactName?.trim() || 'Unknown',
      title: item.contactTitle,
      email: item.contactEmail?.trim().toLowerCase(),
      phone: item.contactPhone,
      linkedinUrl: item.contactLinkedin,
      dedupeKey: contactDedupeKey({ email: item.contactEmail, fullName: item.contactName }),
    };
  }
  return record;
}

/** Dedupe normalized records by account domain, merging contacts. */
export function dedupeRecords(records: NormalizedRecord[]): NormalizedRecord[] {
  const byDomain = new Map<string, NormalizedRecord>();
  for (const r of records) {
    const existing = byDomain.get(r.domain);
    if (!existing) {
      byDomain.set(r.domain, r);
    } else if (!existing.contact && r.contact) {
      existing.contact = r.contact;
    }
  }
  return [...byDomain.values()];
}

/** Stable hash over an account's signals, used for scoring idempotency. */
export function signalsHash(
  signals: { type: string; value: unknown; weight: string | number }[],
): string {
  const canonical = signals
    .map((s) => ({ type: s.type, value: s.value, weight: String(s.weight) }))
    .sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 32);
}
