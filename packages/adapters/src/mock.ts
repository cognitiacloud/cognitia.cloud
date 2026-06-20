import type {
  CallOutcome,
  CreateLeadInput,
  ScheduleCallInput,
  VendorCall,
  VendorEvent,
  VendorLead,
  VoiceVendorAdapter,
  WebhookRequest,
} from './types';

/**
 * Network-free vendor used in MOCK_MODE and tests. `simulateOutcome` builds a
 * webhook request as if the vendor had called back, so the full lead → call →
 * outcome loop can be exercised end-to-end without a real vendor.
 */
export class MockVoiceAgentAdapter implements VoiceVendorAdapter {
  readonly name = 'mock' as const;

  async createLead(input: CreateLeadInput): Promise<VendorLead> {
    return { externalId: `mock-lead-${input.contactId}`, status: 'created' };
  }

  async scheduleCall(input: ScheduleCallInput): Promise<VendorCall> {
    return {
      externalId: `mock-call-${input.leadExternalId}`,
      status: 'scheduled',
      scheduledFor: input.scheduledFor,
    };
  }

  async getCall(externalId: string): Promise<VendorCall> {
    return { externalId, status: 'completed' };
  }

  verifySignature(_req: WebhookRequest): boolean {
    return true;
  }

  async parseWebhook(req: WebhookRequest): Promise<VendorEvent> {
    const body = JSON.parse(req.rawBody) as {
      eventType: VendorEvent['eventType'];
      externalId: string;
      outcome?: CallOutcome;
      idempotencyKey?: string;
    };
    return {
      vendor: 'mock',
      eventType: body.eventType,
      externalId: body.externalId,
      outcome: body.outcome,
      idempotencyKey: body.idempotencyKey ?? `mock-${body.externalId}-${body.eventType}`,
      payload: body,
      occurredAt: new Date(),
    };
  }

  /** Test/dev helper: produce a webhook request for a given outcome. */
  simulateOutcome(externalId: string, outcome: CallOutcome): WebhookRequest {
    const eventType = outcome === 'dnc' ? 'dnc_requested' : 'call_completed';
    return {
      headers: { 'content-type': 'application/json' },
      rawBody: JSON.stringify({
        eventType,
        externalId,
        outcome,
        idempotencyKey: `mock-${externalId}-${outcome}`,
      }),
    };
  }
}
