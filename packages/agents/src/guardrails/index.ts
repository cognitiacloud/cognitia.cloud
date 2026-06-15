import type { MessageCandidate } from '../mira/messageGenerator.js';

export interface GuardrailResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface GuardrailContext {
  /** True if the target contact is on the suppression list / opted out. */
  isSuppressed: boolean;
  /** Whether the message intends personalization (claims about the prospect). */
  personalized: boolean;
}

/** Guardrails whose failure must BLOCK a proposal from being executable. */
export const BLOCKING_GUARDRAILS = new Set(['suppression', 'evidence']);

/**
 * Run Mira's guardrail suite. Returns one result per guardrail. The orchestrator
 * blocks a proposal if any BLOCKING_GUARDRAILS failed.
 */
export function runGuardrails(
  candidate: MessageCandidate,
  ctx: GuardrailContext,
): GuardrailResult[] {
  return [
    suppressionCheck(ctx),
    evidenceCheck(candidate, ctx),
    spamminessCheck(candidate),
    brandVoiceCheck(candidate),
    complianceCheck(candidate),
  ];
}

function suppressionCheck(ctx: GuardrailContext): GuardrailResult {
  return {
    name: 'suppression',
    passed: !ctx.isSuppressed,
    detail: ctx.isSuppressed ? 'target is suppressed/opted-out' : undefined,
  };
}

function evidenceCheck(candidate: MessageCandidate, ctx: GuardrailContext): GuardrailResult {
  // Personalized messages must cite at least one evidence ref.
  const grounded = candidate.evidence_refs.length > 0;
  const passed = !ctx.personalized || grounded;
  return {
    name: 'evidence',
    passed,
    detail: passed ? undefined : 'personalized claims lack evidence refs',
  };
}

function spamminessCheck(candidate: MessageCandidate): GuardrailResult {
  const text = `${candidate.subject_line} ${candidate.body}`.toLowerCase();
  const spamWords = [
    'free money',
    'act now',
    'limited time',
    'guarantee',
    '100% free',
    'click here',
  ];
  const hit = spamWords.find((w) => text.includes(w));
  const linkCount = (candidate.body.match(/https?:\/\//g) ?? []).length;
  const passed = !hit && linkCount <= 2;
  return {
    name: 'spamminess',
    passed,
    detail: hit ? `spam phrase: "${hit}"` : linkCount > 2 ? 'too many links' : undefined,
  };
}

function brandVoiceCheck(_candidate: MessageCandidate): GuardrailResult {
  // Placeholder: real brand-voice scoring lands with the eval rubric.
  return { name: 'brand_voice', passed: true, detail: 'placeholder' };
}

function complianceCheck(candidate: MessageCandidate): GuardrailResult {
  // Placeholder: require an opt-out affordance as a minimal compliance signal.
  const hasOptOut = /stop|unsubscribe|opt out/i.test(candidate.body);
  return {
    name: 'compliance',
    passed: hasOptOut,
    detail: hasOptOut ? 'placeholder' : 'missing opt-out language',
  };
}
