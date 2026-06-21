import type {
  ApifyActorConfig,
  ApifyDatasetItem,
  CloserEvidence,
  NormalizedCloserRecord,
} from './types.js';
import { classifyPiiRisk, hashContactValue, redactContactFields } from './redaction.js';

/**
 * Deterministic normalizers (pure; no env, no I/O). Map heterogeneous Apify
 * dataset items into company-level NormalizedCloserRecords with stable dedupe
 * keys, redacted raw payloads, and (only when present) business-contact hashes.
 * Never dedupes on email/phone; never keeps raw PII.
 */

function str(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Case-insensitive first-non-empty string pick over candidate keys. */
function pick(item: ApifyDatasetItem, keys: string[]): string | null {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(item)) lower.set(k.toLowerCase(), v);
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    const s = str(v);
    if (s) return s;
  }
  return null;
}

function pickNum(item: ApifyDatasetItem, keys: string[]): number | null {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(item)) lower.set(k.toLowerCase(), v);
  for (const key of keys) {
    const n = num(lower.get(key.toLowerCase()));
    if (n !== null) return n;
  }
  return null;
}

/** Extract a bare registrable-ish domain from a website/url. */
export function extractBusinessDomain(website: string | null): string | null {
  if (!website) return null;
  let host = website.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, '').replace(/^www\./, '');
  host = host.split('/')[0]!.split('?')[0]!.split('#')[0]!;
  host = host.split(':')[0]!;
  return host.length > 0 && host.includes('.') ? host : null;
}

/** Lowercase, collapse non-alphanumerics to single hyphens, trim hyphens. */
export function normalizeBusinessName(name: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Stable dedupe key: prefer the website domain; else a slug of
 * source + business name + city + region. Never email/phone. Tenant scoping is
 * provided by the (tenant_id, scrape_run_id, dedupe_key) unique constraint.
 */
export function buildCloserDedupeKey(input: {
  sourceId: string;
  website: string | null;
  accountName: string | null;
  city: string | null;
  provinceOrState: string | null;
}): string {
  const domain = extractBusinessDomain(input.website);
  if (domain) return `domain:${domain}`;
  const parts = [
    input.sourceId,
    normalizeBusinessName(input.accountName),
    normalizeBusinessName(input.city),
    normalizeBusinessName(input.provinceOrState),
  ].filter((p) => p.length > 0);
  return `name:${parts.join('|')}`;
}

export interface NormalizeOptions {
  sourceId: string;
  actor: ApifyActorConfig;
  providerRunId: string | null;
  collectedAt: string;
}

/**
 * Normalize one dataset item. Returns null when there is no usable company
 * identity (name or website) — such items are skipped, not staged.
 */
export function normalizeDatasetItem(
  item: ApifyDatasetItem,
  opts: NormalizeOptions,
): NormalizedCloserRecord | null {
  const accountName = pick(item, ['companyName', 'name', 'title', 'businessName']);
  const website = pick(item, ['website', 'url', 'domain', 'webUrl', 'site']);
  if (!accountName && !website) return null;

  const city = pick(item, ['city', 'town', 'locality']);
  const provinceOrState = pick(item, [
    'provinceOrState',
    'province',
    'state',
    'region',
    'administrativeArea',
  ]);
  const country = pick(item, ['country', 'countryCode']);
  const category = pick(item, ['category', 'categoryName', 'type']);
  const sourceUrl = pick(item, ['sourceUrl', 'url', 'detailUrl', 'permalink', 'website']);
  const rating = pickNum(item, ['rating', 'stars', 'score']);
  const reviewCount = pickNum(item, ['reviewCount', 'reviewsCount', 'userRatingCount', 'reviews']);
  const inventorySignal = pick(item, ['inventorySignal', 'inventory', 'inStock']);

  // Extract any business-contact values BEFORE redaction, to hash (never store raw).
  const rawEmail = pick(item, ['contactEmail', 'email']) ?? firstArrayString(item, ['emails']);
  const rawPhone =
    pick(item, ['contactPhone', 'phone', 'mobile']) ?? firstArrayString(item, ['phones']);

  const { redacted, removed } = redactContactFields(item);
  const piiRisk = classifyPiiRisk(item);

  const contactHashes: { emailHash?: string; phoneHash?: string } = {};
  if (rawEmail) contactHashes.emailHash = hashContactValue(rawEmail, 'email');
  if (rawPhone) contactHashes.phoneHash = hashContactValue(rawPhone, 'phone');

  const complianceFlags: string[] = [`pii_risk:${piiRisk}`];
  if (removed) complianceFlags.push('redacted_contact_fields');
  if (opts.actor.productionStatus !== 'production') complianceFlags.push('non_production_source');
  if (opts.actor.riskLevel === 'legal_review_required')
    complianceFlags.push('legal_review_required');

  const evidence: CloserEvidence = {
    sourceUrl,
    actorId: opts.actor.actorId,
    providerRunId: opts.providerRunId,
    collectedAt: opts.collectedAt,
  };

  let confidence = 0.4;
  if (website) confidence += 0.3;
  if (accountName) confidence += 0.2;
  if (city && provinceOrState) confidence += 0.1;
  confidence = Math.min(1, Number(confidence.toFixed(2)));

  return {
    sourceId: opts.sourceId,
    sourceUrl,
    accountName,
    website,
    city,
    provinceOrState,
    country,
    category,
    rating,
    reviewCount,
    inventorySignal,
    evidence,
    dedupeKey: buildCloserDedupeKey({
      sourceId: opts.sourceId,
      website,
      accountName,
      city,
      provinceOrState,
    }),
    rawRedacted: redacted as Record<string, unknown>,
    contactHashes: Object.keys(contactHashes).length > 0 ? contactHashes : undefined,
    complianceFlags,
    confidence,
  };
}

function firstArrayString(item: ApifyDatasetItem, keys: string[]): string | null {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(item)) lower.set(k.toLowerCase(), v);
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && v[0].trim()) {
      return v[0].trim();
    }
  }
  return null;
}

export interface NormalizeManyResult {
  records: NormalizedCloserRecord[];
  skipped: number;
}

export function normalizeDatasetItems(
  items: ApifyDatasetItem[],
  opts: NormalizeOptions,
): NormalizeManyResult {
  const records: NormalizedCloserRecord[] = [];
  let skipped = 0;
  for (const item of items) {
    const record = normalizeDatasetItem(item, opts);
    if (record) records.push(record);
    else skipped += 1;
  }
  return { records, skipped };
}
