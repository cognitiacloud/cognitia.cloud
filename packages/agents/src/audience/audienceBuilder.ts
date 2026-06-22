/**
 * Audience builder — Sales Closer GTM, lane B4.
 *
 * Lawful, fixture/manual-input audience + signal builder. There is NO scraping,
 * NO Google Maps scraping, NO Apify, NO external API, NO network. Input is a
 * manual CSV-like array of rows (a fixture or an operator-provided `.example`
 * dataset). The builder:
 *
 *   1. Validates each row's source against an explicit allow-list of LAWFUL
 *      source labels and rejects everything else with a clear reason.
 *   2. Normalizes attributes and strips/keeps only PII-safe contact fields
 *      (`.example` addresses / `555-01xx` numbers only — any other-looking
 *      contact value is treated as raw PII and dropped).
 *   3. Derives a consent-risk and source-risk band, attaches evidence tags, and
 *      scores each accepted prospect with the deterministic signal model.
 *   4. Returns prospects ranked by score (desc), plus the list of rejections.
 *
 * Pure and deterministic: no IO, no clock, no randomness. Ranking ties break by
 * `id` ascending for stable, reproducible ordering.
 *
 * Capability labelling: REAL deterministic logic. Operates on MOCK/SANDBOX
 * fixture rows only. `licensed_provider_planned` is a PLANNED source label that
 * is accepted structurally but carries elevated source risk and an explicit
 * tag — no live provider is integrated. See audience-signal-builder.md.
 */

import {
  scoreSignals,
  type EvidenceTag,
  type RiskBand,
  type SignalScore,
} from './signalScoring.js';

/**
 * The lawful source labels this builder accepts. ANY other value is rejected.
 *
 *   - manual                    — keyed in by an operator from a lawful basis.
 *   - consented_csv             — a CSV the data subjects consented to share.
 *   - public_site_manual_review — a public business page reviewed by a human (no bot scrape).
 *   - licensed_provider_planned — a licensed data provider, PLANNED only (not yet integrated).
 */
export const LAWFUL_SOURCE_LABELS = [
  'manual',
  'consented_csv',
  'public_site_manual_review',
  'licensed_provider_planned',
] as const;

export type LawfulSourceLabel = (typeof LAWFUL_SOURCE_LABELS)[number];

/** Consent posture asserted for a row. Drives the consent-risk band. */
export type ConsentBasis = 'explicit_consent' | 'legitimate_interest' | 'not_established';

/**
 * One raw input row. Business attributes only; contact fields MUST be safe
 * placeholders (`.example` domains / `555-01xx` numbers) or they are dropped.
 */
export interface AudienceInputRow {
  /** Stable identifier for the row (used for tie-break ordering). */
  id: string;
  /** Business / company name (non-PII). */
  companyName: string;
  /** Lawful source label. Validated against {@link LAWFUL_SOURCE_LABELS}. */
  source: string;
  /** ICP fit, 0..1. Optional; defaults to a neutral 0.5 prior. */
  fit?: number;
  /** Buying-signal urgency, 0..1. Optional; defaults to neutral 0.5. */
  urgency?: number;
  /** Consent posture. Optional; defaults to `not_established` (most cautious). */
  consentBasis?: ConsentBasis;
  /** Evidence quality for the row's attributes. Optional; defaults to `unknown`. */
  evidence?: EvidenceTag;
  /** Optional region (non-PII). */
  region?: string;
  /** Optional contact email — kept ONLY if it ends in `.example`. */
  contactEmailExample?: string;
  /** Optional contact phone — kept ONLY if it matches a `555-01xx` test number. */
  contactPhoneExample?: string;
  /** Optional free-form non-PII notes. */
  notes?: string;
}

/** A scored, ranked prospect emitted by the builder. PII-safe by construction. */
export interface RankedProspect {
  id: string;
  companyName: string;
  source: LawfulSourceLabel;
  region: string | null;
  /** Safe contact placeholders only; null when input was unsafe/absent. */
  contactEmailExample: string | null;
  contactPhoneExample: string | null;
  consentRisk: RiskBand;
  sourceRisk: RiskBand;
  evidence: EvidenceTag;
  /** Human-readable evidence/provenance tags for review surfaces. */
  evidenceTags: string[];
  /** Deterministic score + transparent breakdown. */
  score: SignalScore;
  notes: string | null;
}

/** A rejected row with a clear, machine- and human-readable reason. */
export interface RejectedRow {
  id: string;
  source: string;
  reason: string;
}

/** The builder's full output. */
export interface AudienceResult {
  /** Accepted prospects, ranked by score desc (id asc tie-break). */
  prospects: RankedProspect[];
  /** Rows rejected during validation, with reasons. */
  rejected: RejectedRow[];
}

/** Source label -> default source-risk band. PLANNED licensed provider is elevated. */
const SOURCE_RISK_BY_LABEL: Record<LawfulSourceLabel, RiskBand> = {
  manual: 'low',
  consented_csv: 'low',
  public_site_manual_review: 'medium',
  licensed_provider_planned: 'high',
};

/** Consent basis -> consent-risk band. */
const CONSENT_RISK_BY_BASIS: Record<ConsentBasis, RiskBand> = {
  explicit_consent: 'low',
  legitimate_interest: 'medium',
  not_established: 'high',
};

const EMAIL_EXAMPLE_RE = /^[^\s@]+@[^\s@]+\.example$/i;
const PHONE_555_01XX_RE = /^(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?555[\s.-]?01\d{2}$/;

function isLawfulSource(source: string): source is LawfulSourceLabel {
  return (LAWFUL_SOURCE_LABELS as readonly string[]).includes(source);
}

function safeEmail(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return EMAIL_EXAMPLE_RE.test(v) ? v.toLowerCase() : null;
}

function safePhone(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return PHONE_555_01XX_RE.test(v) ? v : null;
}

function trimOrNull(value: string | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

/**
 * Build a ranked, PII-safe prospect audience from manual/fixture rows.
 *
 * Rows with a disallowed (non-lawful) source label are rejected with a clear
 * reason and never scored. Accepted rows are normalized, scored, and returned
 * sorted by score descending (ties broken by `id` ascending).
 */
export function buildAudience(rows: AudienceInputRow[]): AudienceResult {
  const prospects: RankedProspect[] = [];
  const rejected: RejectedRow[] = [];

  for (const row of rows) {
    const id = (row.id ?? '').trim();
    const source = (row.source ?? '').trim();

    if (!id) {
      rejected.push({
        id: row.id ?? '',
        source,
        reason: 'missing_id: every row must have a stable non-empty id',
      });
      continue;
    }

    if (!isLawfulSource(source)) {
      rejected.push({
        id,
        source,
        reason: `disallowed_source: "${source || '(empty)'}" is not a lawful source label. Allowed: ${LAWFUL_SOURCE_LABELS.join(', ')}`,
      });
      continue;
    }

    const consentBasis: ConsentBasis = row.consentBasis ?? 'not_established';
    const evidence: EvidenceTag = row.evidence ?? 'unknown';
    const consentRisk = CONSENT_RISK_BY_BASIS[consentBasis];
    const sourceRisk = SOURCE_RISK_BY_LABEL[source];

    const score = scoreSignals({
      fit: row.fit ?? 0.5,
      urgency: row.urgency ?? 0.5,
      consentRisk,
      sourceRisk,
      evidence,
    });

    const contactEmailExample = safeEmail(row.contactEmailExample);
    const contactPhoneExample = safePhone(row.contactPhoneExample);

    const evidenceTags = buildEvidenceTags({
      source,
      consentBasis,
      evidence,
      hadEmailInput: row.contactEmailExample != null,
      hadPhoneInput: row.contactPhoneExample != null,
      keptEmail: contactEmailExample != null,
      keptPhone: contactPhoneExample != null,
    });

    prospects.push({
      id,
      companyName: trimOrNull(row.companyName) ?? '',
      source,
      region: trimOrNull(row.region),
      contactEmailExample,
      contactPhoneExample,
      consentRisk,
      sourceRisk,
      evidence,
      evidenceTags,
      score,
      notes: trimOrNull(row.notes),
    });
  }

  prospects.sort((a, b) => {
    if (b.score.score !== a.score.score) return b.score.score - a.score.score;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { prospects, rejected };
}

function buildEvidenceTags(args: {
  source: LawfulSourceLabel;
  consentBasis: ConsentBasis;
  evidence: EvidenceTag;
  hadEmailInput: boolean;
  hadPhoneInput: boolean;
  keptEmail: boolean;
  keptPhone: boolean;
}): string[] {
  const tags: string[] = [`source:${args.source}`, `consent:${args.consentBasis}`, `evidence:${args.evidence}`];
  if (args.source === 'licensed_provider_planned') tags.push('label:PLANNED');
  else tags.push('label:SANDBOX');
  if (args.hadEmailInput && !args.keptEmail) tags.push('dropped_unsafe_email');
  if (args.hadPhoneInput && !args.keptPhone) tags.push('dropped_unsafe_phone');
  return tags;
}
