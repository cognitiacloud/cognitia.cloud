// lib/guardrails.ts
// Claim-risk classifier + safe-rewrite helper. Pure and dependency-free so it can
// run in the browser, on the server, and in tests. This is the safety seam every
// AI draft, message, listing, and social/content post passes through.

export type ClaimType =
  | 'finance'
  | 'trade_in'
  | 'warranty'
  | 'accident_history'
  | 'promotion'
  | 'compliance'
  | 'complaint'
  | 'price'
  | 'availability';

export type RiskLevel = 'low' | 'medium' | 'high';

/** Claim types that always require a human in the loop. */
const HIGH_RISK: ReadonlySet<ClaimType> = new Set([
  'finance',
  'trade_in',
  'warranty',
  'accident_history',
  'compliance',
  'complaint',
]);

/** Claim types that need conservative wording / review but are lower stakes. */
const MEDIUM_RISK: ReadonlySet<ClaimType> = new Set(['promotion', 'price', 'availability']);

/** Stable detection order so output is deterministic and testable. */
const CLAIM_ORDER: ClaimType[] = [
  'finance',
  'trade_in',
  'warranty',
  'accident_history',
  'promotion',
  'compliance',
  'complaint',
  'price',
  'availability',
];

const CLAIM_PATTERNS: Record<ClaimType, RegExp[]> = {
  finance: [
    /financ/i,
    /\bloan\b/i,
    /\bapr\b/i,
    /\bcredit\b/i,
    /\bapprov/i,
    /monthly payment/i,
    /\blease\b/i,
  ],
  trade_in: [
    /trade[\s-]?in/i,
    /trade value/i,
    /\bappraisal\b/i,
    /my (current )?(car|vehicle) worth/i,
  ],
  warranty: [/warrant/i, /powertrain coverage/i, /extended coverage/i],
  accident_history: [
    /accident/i,
    /\bcarfax\b/i,
    /collision/i,
    /clean title/i,
    /\bclean history\b/i,
  ],
  promotion: [
    /promo/i,
    /discount/i,
    /\brebate\b/i,
    /\bsale\b/i,
    /\bdeal\b/i,
    /\boffer\b/i,
    /limited time/i,
  ],
  compliance: [
    /\bcasl\b/i,
    /\bgdpr\b/i,
    /unsubscribe/i,
    /\bconsent\b/i,
    /privacy/i,
    /\blegal\b/i,
    /\bcompliance\b/i,
  ],
  complaint: [
    /complain/i,
    /\brefund\b/i,
    /\bangry\b/i,
    /\bupset\b/i,
    /\bscam\b/i,
    /terrible|awful|worst/i,
    /\bsue\b|lawsuit/i,
  ],
  price: [/\bprice\b/i, /\bcost\b/i, /how much/i, /best price/i, /lowest price/i, /\$\s?\d/],
  availability: [
    /\bavailab/i,
    /in stock/i,
    /still (have|there|available)/i,
    /\bsold\b/i,
    /\breserved\b/i,
  ],
};

/** Detect every claim type present in free text. Deterministic, deduped, ordered. */
export function detectClaimTypes(text: string): ClaimType[] {
  if (!text) return [];
  return CLAIM_ORDER.filter((type) => CLAIM_PATTERNS[type].some((re) => re.test(text)));
}

/** Highest risk wins. No claims ⇒ low. */
export function riskForClaimTypes(types: ClaimType[]): RiskLevel {
  if (types.some((t) => HIGH_RISK.has(t))) return 'high';
  if (types.some((t) => MEDIUM_RISK.has(t))) return 'medium';
  return 'low';
}

/** Any sensitive claim type requires human approval. */
export function requiresHumanApproval(types: ClaimType[]): boolean {
  return types.length > 0;
}

export interface ClaimScan {
  claimTypes: ClaimType[];
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  flagged: boolean;
}

/** One-call classifier used across drafts, messages, listings, content, social. */
export function scanSensitiveClaims(text: string): ClaimScan {
  const claimTypes = detectClaimTypes(text);
  const riskLevel = riskForClaimTypes(claimTypes);
  return {
    claimTypes,
    riskLevel,
    requiresApproval: requiresHumanApproval(claimTypes),
    flagged: claimTypes.length > 0,
  };
}

/** Conservative wording suggested when a claim is flagged. */
const SAFE_PHRASES: Record<ClaimType, string> = {
  finance: 'financing options can be reviewed with our team on approved credit',
  trade_in: 'we can review your trade-in details and confirm a value with the dealership',
  warranty: 'warranty coverage can be confirmed with the dealership',
  accident_history: 'a vehicle history report (CarFax) is available on request',
  promotion: 'current offers can be confirmed with the dealership',
  price: 'please ask us to confirm current pricing',
  availability: 'we can confirm current availability for you',
  compliance: 'we follow consent-based, CASL-aware communication',
  complaint: 'a team member will follow up with you directly',
};

/**
 * Append conservative clarifications for each flagged claim. We do NOT silently
 * delete the human's words — we add a reviewer-facing safe rewrite they can apply.
 */
export function suggestSaferRewrite(text: string, types: ClaimType[]): string {
  const additions = types.map((t) => SAFE_PHRASES[t]).filter((v, i, arr) => arr.indexOf(v) === i);
  if (additions.length === 0) return text.trim();
  const clarifier =
    'To stay accurate: ' +
    additions.join('; ') +
    '. Final details are confirmed by the dealership.';
  return `${text.trim()}\n\n${clarifier}`;
}
