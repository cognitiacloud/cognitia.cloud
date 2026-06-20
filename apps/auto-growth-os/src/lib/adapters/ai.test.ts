import { describe, expect, it } from 'vitest';
import type { Lead } from '../../types';
import { adapters } from './index';
import { MockAiAgentAdapter } from './ai';
import { generateSafeReplyDraft } from '../ai-drafts';
import { scanSensitiveClaims } from '../guardrails';

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: 'L1',
    name: 'Test Buyer',
    email: 't@example.com',
    phone: '+1 555 0100',
    source: 'Website',
    vehicleInterest: 'a used SUV',
    vehicleId: null,
    budgetCad: null,
    message: '',
    signals: {
      appointmentRequested: false,
      financingRequested: false,
      tradeInMentioned: false,
      budgetProvided: false,
      respondToday: false,
      specificVehicleSelected: false,
    },
    score: 10,
    stage: 'Nurture',
    owner: 'Unassigned',
    nextAction: 'Follow up',
    consent: { email: true, sms: false, whatsapp: false, capturedAt: null, basis: 'implied' },
    firstResponseMinutes: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('MockAiAgentAdapter.draftReply', () => {
  it('always requires human approval and never auto-sends', async () => {
    const res = await new MockAiAgentAdapter().draftReply({ lead: lead(), history: [] });
    expect(res.requiresHumanApproval).toBe(true);
    expect(res.draft.length).toBeGreaterThan(0);
  });

  it('delegates its draft body to the shared generateSafeReplyDraft generator', async () => {
    const l = lead({ name: 'Dana Singh' });
    const res = await new MockAiAgentAdapter().draftReply({ lead: l, history: [] });
    expect(res.draft).toBe(generateSafeReplyDraft(l).content);
  });

  it('produces a draft that the guardrails flag for a financing lead', async () => {
    const l = lead({ signals: { ...lead().signals, financingRequested: true } });
    const res = await new MockAiAgentAdapter().draftReply({ lead: l, history: [] });
    expect(scanSensitiveClaims(res.draft).claimTypes).toContain('finance');
  });
});

describe('adapters registry', () => {
  it('exposes the AI agent behind the registry seam', async () => {
    expect(adapters.ai).toBeInstanceOf(MockAiAgentAdapter);
    const res = await adapters.ai.draftReply({ lead: lead(), history: [] });
    expect(res.requiresHumanApproval).toBe(true);
  });
});
