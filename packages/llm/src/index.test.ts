import { describe, it, expect } from 'vitest';
import { MockLlmProvider } from './providers/mock';
import { parseJsonResponse } from './util';
import type { ScoreInput } from './types';

const input: ScoreInput = {
  account: { domain: 'acme.com', displayName: 'Acme', industry: 'SaaS', employeeRange: '51-200' },
  signals: [
    { type: 'tech_stack', value: { tools: ['HubSpot'] }, weight: 2 },
    { type: 'hiring', value: { openSalesRoles: 3 }, weight: 1.5 },
  ],
};

describe('MockLlmProvider', () => {
  it('is deterministic for the same input', async () => {
    const llm = new MockLlmProvider();
    const a = await llm.scoreAccount(input);
    const b = await llm.scoreAccount(input);
    expect(a).toEqual(b);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.breakdown).toHaveProperty('fit');
  });

  it('produces a brief with required keys', async () => {
    const llm = new MockLlmProvider();
    const score = await llm.scoreAccount(input);
    const brief = await llm.generateBrief({ ...input, score });
    expect(brief.painPoints.length).toBeGreaterThan(0);
    expect(brief.recommendedChannel).toBe('voice');
  });
});

describe('parseJsonResponse', () => {
  it('extracts JSON embedded in prose', () => {
    expect(parseJsonResponse<{ a: number }>('here: {"a": 1} done')).toEqual({ a: 1 });
  });
  it('throws on missing JSON', () => {
    expect(() => parseJsonResponse('no json')).toThrow();
  });
});
