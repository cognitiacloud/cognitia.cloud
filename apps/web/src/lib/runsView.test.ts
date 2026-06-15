import { describe, it, expect } from 'vitest';
import type { RunPlanView } from './apiClient.js';
import { actionTypeLabel, summarizeRollup, runNeedsReview, runStatusOptions } from './runsView.js';

function rollup(over: Partial<RunPlanView['rollup']> = {}): RunPlanView['rollup'] {
  return {
    total: 0,
    proposed: 0,
    approved: 0,
    rejected: 0,
    executed: 0,
    rolled_back: 0,
    action_types: {},
    ...over,
  };
}

describe('runs view-model', () => {
  it('labels known action types and falls back to the raw type', () => {
    expect(actionTypeLabel('crm.task.create')).toBe('CRM task');
    expect(actionTypeLabel('crm.note.create')).toBe('CRM note');
    expect(actionTypeLabel('email.draft.send')).toBe('Email');
    expect(actionTypeLabel('sms.send_real')).toBe('sms.send_real');
  });

  it('summarizes rollup counts in a stable order', () => {
    const chips = summarizeRollup(rollup({ proposed: 2, approved: 1, executed: 3 }));
    expect(chips.map((c) => c.key)).toEqual([
      'proposed',
      'approved',
      'rejected',
      'executed',
      'rolled_back',
    ]);
    expect(chips.find((c) => c.key === 'executed')?.count).toBe(3);
  });

  it('nonZeroOnly hides empty buckets to keep list rows quiet', () => {
    const chips = summarizeRollup(rollup({ approved: 1, rolled_back: 2 }), { nonZeroOnly: true });
    expect(chips.map((c) => c.key)).toEqual(['approved', 'rolled_back']);
  });

  it('needs review reflects fully_reviewed, then falls back to proposed count', () => {
    expect(runNeedsReview({ fully_reviewed: false, rollup: rollup() })).toBe(true);
    expect(runNeedsReview({ fully_reviewed: true, rollup: rollup({ proposed: 5 }) })).toBe(false);
    // Resilient if the field is missing on the payload.
    expect(
      runNeedsReview({ rollup: rollup({ proposed: 1 }) } as Pick<
        RunPlanView,
        'fully_reviewed' | 'rollup'
      >),
    ).toBe(true);
  });

  it('lists distinct run statuses in first-seen order', () => {
    expect(
      runStatusOptions([
        { status: 'running' },
        { status: 'completed' },
        { status: 'running' },
        { status: 'failed' },
      ]),
    ).toEqual(['running', 'completed', 'failed']);
  });
});
