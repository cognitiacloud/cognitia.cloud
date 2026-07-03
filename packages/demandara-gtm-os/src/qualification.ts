import type { DemandaraLead } from './types.js';
import type { VerticalAdapter } from './verticalAdapters.js';

/**
 * Qualification — score avatar fit, urgency, and trust gap, and recommend the
 * next step (03_DEMANDARA_GTM_OS_PRODUCT_CONTEXT.md). Deterministic and pure:
 * no model call is required for the chassis; the model-router harness can
 * decorate copy later but can never change gate outcomes.
 */

export interface TrustGap {
  label: string;
  severity: number; // 0..1
}

export interface QualificationResult {
  status: 'qualified' | 'disqualified';
  avatarFit: number; // 0..1
  urgency: number; // 0..1
  compositeScore: number; // 0..1
  trustGap: TrustGap;
  recommendedNextStep: string;
  disqualifiedBecause: string | null;
}

const round = (n: number): number => Math.round(n * 100) / 100;

export function qualifyLead(lead: DemandaraLead, adapter: VerticalAdapter): QualificationResult {
  const segmentKnown = adapter.avatarSegments.includes(lead.avatarSegment);
  const painKnown = adapter.painCategories.includes(lead.painCategory);

  // Avatar fit: known segment is the base; a known pain category confirms fit;
  // intent signals add a small deterministic boost.
  let avatarFit = segmentKnown ? 0.6 : 0.1;
  if (painKnown) avatarFit += 0.25;
  avatarFit += Math.min(lead.intentSignals.length, 3) * 0.05;
  avatarFit = round(Math.min(avatarFit, 1));

  const urgency = adapter.urgencyByTimeline[lead.desiredTimeline];

  const trustGapLabel =
    adapter.trustGapByPain[lead.painCategory] ??
    'Trust gap not mapped for this pain category; treat as unknown and review manually.';
  const trustGapSeverity = painKnown ? round(0.4 + urgency * 0.5) : 0.9;

  const compositeScore = round(avatarFit * 0.5 + urgency * 0.3 + (1 - trustGapSeverity) * 0.2);

  const qualified = segmentKnown && painKnown && avatarFit >= 0.5;
  const recommendedNextStep = qualified
    ? (adapter.nextStepBySegment[lead.avatarSegment] ?? adapter.fallbackNextStep)
    : adapter.fallbackNextStep;

  return {
    status: qualified ? 'qualified' : 'disqualified',
    avatarFit,
    urgency,
    compositeScore,
    trustGap: { label: trustGapLabel, severity: trustGapSeverity },
    recommendedNextStep,
    disqualifiedBecause: qualified
      ? null
      : !segmentKnown
        ? `Avatar segment '${lead.avatarSegment}' is outside this vertical's served segments.`
        : !painKnown
          ? `Pain category '${lead.painCategory}' is outside this vertical's playbook.`
          : 'Avatar fit below qualification threshold.',
  };
}
