import { describe, expect, it } from 'vitest';
import { createDeterministicEnv } from '../ids.js';
import { ApprovalError, ApprovalQueue } from './approvalQueue.js';

function makeQueue(): ApprovalQueue {
  return new ApprovalQueue(createDeterministicEnv());
}

describe('human approval queue', () => {
  it('cannot auto-approve — a decision requires a named human', () => {
    const queue = makeQueue();
    const req = queue.request({
      runId: 'r',
      tenantId: 'cognitia_internal',
      action: 'a',
      summary: 's',
    });
    expect(queue.isApproved('r')).toBe(false);
    expect(() => queue.decide(req.id, { outcome: 'approved', approver: '   ' })).toThrow(
      ApprovalError,
    );
    expect(queue.isApproved('r')).toBe(false);
  });

  it('records the approver and forbids deciding twice', () => {
    const queue = makeQueue();
    const req = queue.request({
      runId: 'r',
      tenantId: 'cognitia_internal',
      action: 'a',
      summary: 's',
    });
    const decided = queue.decide(req.id, { outcome: 'approved', approver: 'operator:jess' });
    expect(decided.status).toBe('approved');
    expect(decided.approver).toBe('operator:jess');
    expect(queue.isApproved('r')).toBe(true);
    expect(() => queue.decide(req.id, { outcome: 'rejected', approver: 'operator:jess' })).toThrow(
      ApprovalError,
    );
  });

  it('a rejection never marks the run approved', () => {
    const queue = makeQueue();
    const req = queue.request({
      runId: 'r2',
      tenantId: 'cognitia_internal',
      action: 'a',
      summary: 's',
    });
    queue.decide(req.id, { outcome: 'rejected', approver: 'operator:lee', note: 'not now' });
    expect(queue.isApproved('r2')).toBe(false);
  });
});
