/**
 * Eval scaffolding (Phase 3.1). TypeScript interfaces + stub evaluators for
 * message quality, reply classification, and lead scoring. Heavy/offline
 * analysis is delegated to Python under packages/evals/scripts; these contracts
 * keep results typed and loggable into events/eval tables.
 */

export interface EvalItemResult {
  itemRef: string;
  rubric: string;
  score: number; // 0..1
  detail?: Record<string, unknown>;
}

export interface Evaluator<TInput> {
  rubric: string;
  evaluate(input: TInput): Promise<EvalItemResult>;
}

/** Message-quality eval: evidence coverage of personalization claims. */
export interface MessageQualityInput {
  itemRef: string;
  claims: number;
  evidenceRefs: number;
}
export const evidenceCoverageEvaluator: Evaluator<MessageQualityInput> = {
  rubric: 'evidence_coverage',
  async evaluate(input) {
    const score = input.claims === 0 ? 1 : Math.min(1, input.evidenceRefs / input.claims);
    return { itemRef: input.itemRef, rubric: 'evidence_coverage', score };
  },
};

/** Reply-classifier eval: accuracy vs a labeled expectation. */
export interface ReplyClassifierInput {
  itemRef: string;
  predicted: string;
  expected: string;
}
export const replyAccuracyEvaluator: Evaluator<ReplyClassifierInput> = {
  rubric: 'reply_accuracy',
  async evaluate(input) {
    return {
      itemRef: input.itemRef,
      rubric: 'reply_accuracy',
      score: input.predicted === input.expected ? 1 : 0,
      detail: { predicted: input.predicted, expected: input.expected },
    };
  },
};

/** Lead-scoring eval: error vs a labeled score. */
export interface LeadScoringInput {
  itemRef: string;
  predicted: number;
  expected: number;
}
export const leadScoringEvaluator: Evaluator<LeadScoringInput> = {
  rubric: 'lead_scoring',
  async evaluate(input) {
    const err = Math.abs(input.predicted - input.expected);
    return { itemRef: input.itemRef, rubric: 'lead_scoring', score: Math.max(0, 1 - err) };
  },
};

// TODO: brand_voice and spamminess evaluators (call offline Python scorers).

export * from './harness.js';
