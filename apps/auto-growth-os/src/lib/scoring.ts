// lib/scoring.ts
// Pure, framework-free lead scoring. Fully unit-testable in isolation.

import type { ScoringSignals, Stage } from '../types';
import { SCORE_WEIGHTS, STAGE_THRESHOLDS } from './constants';

/**
 * Sum the weighted signals into a 0–100 score.
 *   appointment +25 · financing +20 · trade-in +20
 *   budget +15 · respond-today +10 · specific-vehicle +10
 */
export function scoreLead(signals: ScoringSignals): number {
  let total = 0;
  (Object.keys(SCORE_WEIGHTS) as (keyof ScoringSignals)[]).forEach((key) => {
    if (signals[key]) total += SCORE_WEIGHTS[key];
  });
  return Math.min(100, Math.max(0, total));
}

/**
 * Map a score to a pipeline stage.
 *   0–30 Nurture · 31–60 Qualified · 61–85 Hot Lead · 86+ Immediate Sales Handoff
 */
export function stageForScore(score: number): Stage {
  const match = STAGE_THRESHOLDS.find((t) => score >= t.min);
  return match ? match.stage : 'Nurture';
}

export function scoreAndStage(signals: ScoringSignals): {
  score: number;
  stage: Stage;
} {
  const score = scoreLead(signals);
  return { score, stage: stageForScore(score) };
}

/** Itemized breakdown for the "why this score" panel in the lead detail view. */
export function scoreBreakdown(
  signals: ScoringSignals,
): { key: keyof ScoringSignals; points: number; active: boolean }[] {
  return (Object.keys(SCORE_WEIGHTS) as (keyof ScoringSignals)[]).map((key) => ({
    key,
    points: SCORE_WEIGHTS[key],
    active: signals[key],
  }));
}
