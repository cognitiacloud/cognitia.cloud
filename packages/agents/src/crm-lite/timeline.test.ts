import { describe, expect, it } from 'vitest';
import { assertNoRawPii, createCrmTimeline, type TimelineEvent } from './timeline.js';

const WS = 'budget_wheels_demo';
const PROSPECT = 'prospect-1';

function fixedClock(times: string[]): () => Date {
  let i = 0;
  return () => new Date(times[Math.min(i++, times.length - 1)]!);
}

describe('CrmTimeline', () => {
  it('records lifecycle events for every phase', () => {
    const tl = createCrmTimeline({
      now: () => new Date('2026-06-22T10:00:00.000Z'),
      newId: (() => {
        let n = 0;
        return () => `e${++n}`;
      })(),
    });
    tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'compliance',
      outcome: 'pass',
      summary: 'Compliance passed',
    });
    tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'approval',
      outcome: 'approved',
      summary: 'Human approved outreach',
    });
    tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'appointment',
      outcome: 'ok',
      summary: 'Appointment requested',
      refs: { appointmentRef: 'appt-9' },
    });
    tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'crm_writeback',
      outcome: 'ok',
      summary: 'CRM record written (mock)',
      refs: { crmRecordRef: 'rec-3' },
    });
    tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'proof',
      outcome: 'ok',
      summary: 'Proof recorded',
    });

    const events = tl.read({ workspaceId: WS, prospectId: PROSPECT });
    expect(events.map((e) => e.kind)).toEqual([
      'compliance',
      'approval',
      'appointment',
      'crm_writeback',
      'proof',
    ]);
    expect(events.every((e) => e.environment === 'MOCK')).toBe(true);
  });

  it('happy path: ordered by time then stable insertion seq', () => {
    const tl = createCrmTimeline({
      now: fixedClock([
        '2026-06-22T10:00:00.000Z',
        '2026-06-22T10:00:00.000Z',
        '2026-06-22T09:00:00.000Z',
      ]),
    });
    const a = tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'compliance',
      outcome: 'pass',
      summary: 'first at 10:00',
    });
    const b = tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'approval',
      outcome: 'approved',
      summary: 'second at 10:00',
    });
    const c = tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'note',
      outcome: 'info',
      summary: 'earlier at 09:00',
    });

    const ordered = tl.read();
    // earliest time first; equal times keep insertion order (a before b).
    expect(ordered.map((e) => e.id)).toEqual([c.id, a.id, b.id]);
  });

  it('rejected and blocked outcomes are recorded distinctly', () => {
    const tl = createCrmTimeline({ now: () => new Date('2026-06-22T10:00:00.000Z') });
    tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'approval',
      outcome: 'rejected',
      summary: 'Human rejected',
    });
    tl.record({
      workspaceId: WS,
      prospectId: PROSPECT,
      kind: 'compliance',
      outcome: 'blocked',
      summary: 'Do-not-contact',
    });
    const outcomes = tl.read().map((e) => e.outcome);
    expect(outcomes).toContain('rejected');
    expect(outcomes).toContain('blocked');
  });

  it('read returns a fresh array and filters by workspace/prospect', () => {
    const tl = createCrmTimeline({ now: () => new Date('2026-06-22T10:00:00.000Z') });
    tl.record({ workspaceId: WS, prospectId: 'p1', kind: 'note', outcome: 'info', summary: 'a' });
    tl.record({
      workspaceId: 'other',
      prospectId: 'p2',
      kind: 'note',
      outcome: 'info',
      summary: 'b',
    });
    expect(tl.read({ workspaceId: WS })).toHaveLength(1);
    expect(tl.read({ prospectId: 'p2' })).toHaveLength(1);
    const snap = tl.read();
    snap.push({} as TimelineEvent);
    expect(tl.size()).toBe(2);
  });

  describe('assertNoRawPii / no raw PII stored', () => {
    it('allows reserved synthetic emails and 555-01xx phones', () => {
      expect(() => assertNoRawPii('reach gm@dealer.example')).not.toThrow();
      expect(() => assertNoRawPii('qa user@thing.test')).not.toThrow();
      expect(() => assertNoRawPii('call 555-0123')).not.toThrow();
      expect(() => assertNoRawPii('call (604) 555-0188')).not.toThrow();
      expect(() => assertNoRawPii('masked j***@dealer.com')).not.toThrow();
      expect(() => assertNoRawPii('no contact info here')).not.toThrow();
    });

    it('rejects real-looking emails and phones', () => {
      expect(() => assertNoRawPii('email gm@realdealer.com')).toThrow(/email PII/);
      expect(() => assertNoRawPii('phone 604-321-9988')).toThrow(/phone PII/);
    });

    it('record() refuses raw PII in summary and refs', () => {
      const tl = createCrmTimeline({ now: () => new Date('2026-06-22T10:00:00.000Z') });
      expect(() =>
        tl.record({
          workspaceId: WS,
          prospectId: PROSPECT,
          kind: 'note',
          outcome: 'info',
          summary: 'gm@realdealer.com',
        }),
      ).toThrow();
      expect(() =>
        tl.record({
          workspaceId: WS,
          prospectId: PROSPECT,
          kind: 'note',
          outcome: 'info',
          summary: 'ok',
          refs: { x: '604-321-9988' },
        }),
      ).toThrow();
      // none of the rejected writes landed.
      expect(tl.size()).toBe(0);
    });

    it('no stored timeline event contains raw-looking PII', () => {
      const tl = createCrmTimeline({ now: () => new Date('2026-06-22T10:00:00.000Z') });
      tl.record({
        workspaceId: WS,
        prospectId: PROSPECT,
        kind: 'crm_writeback',
        outcome: 'ok',
        summary: 'wrote rec for gm@dealer.example',
        refs: { crmRecordRef: 'rec-1' },
      });
      for (const e of tl.read()) {
        expect(() => assertNoRawPii(JSON.stringify(e))).not.toThrow();
      }
    });
  });
});
