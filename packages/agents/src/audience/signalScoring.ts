/**
 * Audience signal scoring — Sales Closer GTM, lane B4.
 *
 * Pure, deterministic scoring for a lawfully-sourced prospect audience. No IO,
 * no network, no LLM, no scraping. The score combines five transparent
 * components into a single ranked value with a per-component breakdown so a
 * human reviewer can always see WHY a prospect ranks where it does:
 *
 *   - fit            (0..1) — how well the prospect matches the ICP. HIGHER raises score.
 *   - urgency        (0..1) — buying-signal timing/intent. HIGHER raises score.
 *   - consentRisk    (0..1) — legal/consent exposure. HIGHER LOWERS score (penalty).
 *   - sourceRisk     (0..1) — how risky the data source is. HIGHER LOWERS score (penalty).
 *   - proofConfidence(0..1) — how well-evidenced the prospect's attributes are. HIGHER raises score.
 *
 * The model is intentionally a fixed linear blend with documented weights so it
 * is auditable and reproducible. It mirrors the house scoring style in
 * `packages/agents/src/mira/scoring.ts` (neutral priors, clamp01, round to 3dp,
 * weighted combined value).
 *
 * Capability labelling: REAL deterministic math. The inputs it scores are
 * MOCK/SANDBOX fixtures only — see audience-signal-builder.md.
 */

/** A risk band used for both consent and source risk. */
export type RiskBand = 'low' | 'medium' | 'high';

/** Evidence-tag taxonomy, mirroring the platform proof doctrine. */
export type EvidenceTag = 'verified_fact' | 'likely_inference' | 'unknown';

/**
 * The raw signal inputs for one prospect. All values are normalized 0..1 EXCEPT
 * the two risk bands, which are categorical and mapped deterministically.
 */
export interface SignalInputs {
  /** ICP match, 0..1. Clamped. */
  fit: number;
  /** Buying-signal urgency/intent, 0..1. Clamped. */
  urgency: number;
  /** Consent/legal exposure band. */
  consentRisk: RiskBand;
  /** Data-source risk band. */
  sourceRisk: RiskBand;
  /** How well the prospect's attributes are evidenced. */
  evidence: EvidenceTag;
}

/** Per-component contributions, after weighting and sign. Sums (plus base) ~= score. */
export interface ScoreBreakdown {
  /** Positive contribution from fit. */
  fit: number;
  /** Positive contribution from urgency. */
  urgency: number;
  /** Positive contribution from proof confidence. */
  proofConfidence: number;
  /** Negative contribution (penalty) from consent risk. */
  consentRiskPenalty: number;
  /** Negative contribution (penalty) from source risk. */
  sourceRiskPenalty: number;
}

/** The full, transparent scoring result for one prospect. */
export interface SignalScore {
  /** Final ranked score, 0..1. */
  score: number;
  /** Per-component breakdown (signed: penalties are negative). */
  breakdown: ScoreBreakdown;
  /** Normalized inputs actually used (after band->number mapping & clamping). */
  components: {
    fit: number;
    urgency: number;
    proofConfidence: number;
    consentRisk: number;
    sourceRisk: number;
  };
}

/**
 * Fixed, documented weights. Positive weights reward; the two risk weights are
 * applied as penalties (subtracted). Chosen so a perfect, fully-evidenced,
 * zero-risk prospect scores 1.0 and a worst-case prospect floors at 0.
 */
export const SIGNAL_WEIGHTS = {
  fit: 0.4,
  urgency: 0.25,
  proofConfidence: 0.15,
  consentRisk: 0.2,
  sourceRisk: 0.2,
} as const;

/** Deterministic mapping from a categorical risk band to a 0..1 magnitude. */
export const RISK_BAND_VALUE: Record<RiskBand, number> = {
  low: 0,
  medium: 0.5,
  high: 1,
};

/** Deterministic mapping from an evidence tag to a 0..1 proof-confidence value. */
export const EVIDENCE_CONFIDENCE: Record<EvidenceTag, number> = {
  verified_fact: 1,
  likely_inference: 0.5,
  unknown: 0,
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Score one prospect's signals into a ranked 0..1 value with a transparent,
 * signed breakdown. Pure and deterministic: same inputs always yield the same
 * output, with no IO.
 */
export function scoreSignals(inputs: SignalInputs): SignalScore {
  const fit = clamp01(inputs.fit);
  const urgency = clamp01(inputs.urgency);
  const proofConfidence = EVIDENCE_CONFIDENCE[inputs.evidence] ?? 0;
  const consentRisk = RISK_BAND_VALUE[inputs.consentRisk] ?? 0.5;
  const sourceRisk = RISK_BAND_VALUE[inputs.sourceRisk] ?? 0.5;

  const fitContribution = SIGNAL_WEIGHTS.fit * fit;
  const urgencyContribution = SIGNAL_WEIGHTS.urgency * urgency;
  const proofContribution = SIGNAL_WEIGHTS.proofConfidence * proofConfidence;
  const consentPenalty = SIGNAL_WEIGHTS.consentRisk * consentRisk;
  const sourcePenalty = SIGNAL_WEIGHTS.sourceRisk * sourceRisk;

  const raw =
    fitContribution + urgencyContribution + proofContribution - consentPenalty - sourcePenalty;
  const score = clamp01(raw);

  return {
    score: round(score),
    breakdown: {
      fit: round(fitContribution),
      urgency: round(urgencyContribution),
      proofConfidence: round(proofContribution),
      consentRiskPenalty: round(-consentPenalty),
      sourceRiskPenalty: round(-sourcePenalty),
    },
    components: {
      fit: round(fit),
      urgency: round(urgency),
      proofConfidence: round(proofConfidence),
      consentRisk: round(consentRisk),
      sourceRisk: round(sourceRisk),
    },
  };
}
