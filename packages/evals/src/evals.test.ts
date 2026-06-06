import { describe, it, expect } from 'vitest';
import {
  evidenceCoverageEvaluator,
  replyAccuracyEvaluator,
  leadScoringEvaluator,
} from './index.js';

describe('eval stubs', () => {
  it('evidence coverage scores grounded messages 1.0', async () => {
    const r = await evidenceCoverageEvaluator.evaluate({
      itemRef: 'm1',
      claims: 2,
      evidenceRefs: 2,
    });
    expect(r.score).toBe(1);
    const u = await evidenceCoverageEvaluator.evaluate({
      itemRef: 'm2',
      claims: 2,
      evidenceRefs: 0,
    });
    expect(u.score).toBe(0);
  });

  it('reply accuracy is exact-match', async () => {
    const hit = await replyAccuracyEvaluator.evaluate({
      itemRef: 'r1',
      predicted: 'unsubscribe',
      expected: 'unsubscribe',
    });
    expect(hit.score).toBe(1);
  });

  it('lead scoring rewards low error', async () => {
    const r = await leadScoringEvaluator.evaluate({
      itemRef: 'l1',
      predicted: 0.8,
      expected: 0.85,
    });
    expect(r.score).toBeGreaterThan(0.9);
  });
});
