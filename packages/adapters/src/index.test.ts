import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@cognitia/config';
import { MockVoiceAgentAdapter } from './mock';
import { SalesCloserAdapter } from './salescloser';
import type { WebhookRequest } from './types';

describe('MockVoiceAgentAdapter', () => {
  it('runs the lead -> call -> outcome loop', async () => {
    const a = new MockVoiceAgentAdapter();
    const lead = await a.createLead({ accountId: 'acc', contactId: 'c1', fullName: 'Dana' });
    expect(lead.externalId).toContain('mock-lead');

    const call = await a.scheduleCall({ leadExternalId: lead.externalId, scheduledFor: new Date() });
    expect(call.status).toBe('scheduled');

    const req = a.simulateOutcome(call.externalId, 'booked_meeting');
    const event = await a.parseWebhook(req);
    expect(event.eventType).toBe('call_completed');
    expect(event.outcome).toBe('booked_meeting');
    expect(event.idempotencyKey).toBeTruthy();
  });

  it('maps a dnc outcome to dnc_requested', async () => {
    const a = new MockVoiceAgentAdapter();
    const event = await a.parseWebhook(a.simulateOutcome('mock-call-1', 'dnc'));
    expect(event.eventType).toBe('dnc_requested');
  });
});

describe('SalesCloserAdapter signature verification', () => {
  const secret = 'whsec_test';
  beforeEach(() => {
    vi.stubEnv('MOCK_MODE', 'false');
    vi.stubEnv('SALESCLOSER_WEBHOOK_SECRET', secret);
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  function signed(body: string): WebhookRequest {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    return { headers: { 'x-salescloser-signature': sig }, rawBody: body };
  }

  it('accepts a correctly signed payload and maps the event', async () => {
    const a = new SalesCloserAdapter();
    const body = JSON.stringify({ type: 'call.completed', id: 'call_1', outcome: 'meeting_booked' });
    const event = await a.parseWebhook(signed(body));
    expect(event.eventType).toBe('call_completed');
    expect(event.outcome).toBe('booked_meeting');
  });

  it('rejects a tampered payload', () => {
    const a = new SalesCloserAdapter();
    const tampered: WebhookRequest = {
      headers: { 'x-salescloser-signature': 'deadbeef' },
      rawBody: JSON.stringify({ type: 'call.completed', id: 'call_1' }),
    };
    expect(a.verifySignature(tampered)).toBe(false);
  });
});
