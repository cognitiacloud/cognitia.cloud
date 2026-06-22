import { describe, expect, it } from 'vitest';
import { createProofEvent, createLedgerEntry } from './proof';

describe('createProofEvent', () => {
  it('applies injected id and timestamp deterministically', () => {
    const e = createProofEvent(
      {
        kind: 'response_time',
        title: 'First response in 1 min',
        detail: 'Auto-acknowledged on capture',
        source: 'public_form',
        evidenceLabel: 'SLA snapshot',
        relatedLeadId: 'L1',
      },
      'proof-1',
      '2026-06-20T00:00:00.000Z',
    );
    expect(e.id).toBe('proof-1');
    expect(e.createdAt).toBe('2026-06-20T00:00:00.000Z');
    expect(e.relatedLeadId).toBe('L1');
    expect(e.kind).toBe('response_time');
  });

  it('defaults createdAt to a valid ISO timestamp', () => {
    const e = createProofEvent({
      kind: 'approval',
      title: 'Approved',
      detail: 'Human approved a draft',
      source: 'portal',
      evidenceLabel: 'Approval record',
    });
    expect(typeof e.id).toBe('string');
    expect(Number.isNaN(Date.parse(e.createdAt))).toBe(false);
  });
});

describe('createLedgerEntry', () => {
  it('copies fields and applies injected id/now', () => {
    const a = createLedgerEntry(
      {
        actionType: 'approval.decided',
        actorType: 'human',
        actorId: 'u1',
        subjectId: 'draft-1',
        summary: 'Approved reply draft',
        riskLevel: 'high',
      },
      'act-1',
      '2026-06-20T00:00:00.000Z',
    );
    expect(a.id).toBe('act-1');
    expect(a.createdAt).toBe('2026-06-20T00:00:00.000Z');
    expect(a.actionType).toBe('approval.decided');
    expect(a.riskLevel).toBe('high');
  });
});
