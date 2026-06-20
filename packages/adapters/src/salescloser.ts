import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@cognitia/config';
import type {
  CallOutcome,
  CreateLeadInput,
  ScheduleCallInput,
  VendorCall,
  VendorEvent,
  VendorEventType,
  VendorLead,
  VoiceVendorAdapter,
  WebhookRequest,
} from './types';

const SC_EVENT_MAP: Record<string, VendorEventType> = {
  'lead.created': 'lead_created',
  'call.scheduled': 'call_scheduled',
  'call.started': 'call_started',
  'call.completed': 'call_completed',
  'call.failed': 'call_failed',
  'call.voicemail': 'voicemail',
  'call.callback': 'callback_requested',
  'contact.dnc': 'dnc_requested',
};

const SC_OUTCOME_MAP: Record<string, CallOutcome> = {
  connected: 'connected',
  no_answer: 'no_answer',
  voicemail: 'voicemail',
  meeting_booked: 'booked_meeting',
  not_interested: 'not_interested',
  callback: 'callback',
  wrong_number: 'wrong_number',
  dnc: 'dnc',
};

/** Real SalesCloser.ai adapter. */
export class SalesCloserAdapter implements VoiceVendorAdapter {
  readonly name = 'salescloser' as const;

  private headers(): Record<string, string> {
    if (!env.SALESCLOSER_API_KEY) throw new Error('SALESCLOSER_API_KEY is required');
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${env.SALESCLOSER_API_KEY}`,
    };
  }

  async createLead(input: CreateLeadInput): Promise<VendorLead> {
    const res = await fetch(`${env.SALESCLOSER_BASE_URL}/v1/leads`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        name: input.fullName,
        phone: input.phone,
        email: input.email,
        notes: input.briefSummary,
        metadata: { accountId: input.accountId, contactId: input.contactId },
      }),
    });
    if (!res.ok) throw new Error(`SalesCloser createLead ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { id: string; status: string };
    return { externalId: data.id, status: data.status };
  }

  async scheduleCall(input: ScheduleCallInput): Promise<VendorCall> {
    const res = await fetch(`${env.SALESCLOSER_BASE_URL}/v1/calls`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        lead_id: input.leadExternalId,
        scheduled_for: input.scheduledFor.toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`SalesCloser scheduleCall ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { id: string; status: string };
    return { externalId: data.id, status: data.status, scheduledFor: input.scheduledFor };
  }

  async getCall(externalId: string): Promise<VendorCall> {
    const res = await fetch(`${env.SALESCLOSER_BASE_URL}/v1/calls/${externalId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`SalesCloser getCall ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { id: string; status: string };
    return { externalId: data.id, status: data.status };
  }

  verifySignature(req: WebhookRequest): boolean {
    const secret = env.SALESCLOSER_WEBHOOK_SECRET;
    if (!secret) return false;
    const provided = req.headers['x-salescloser-signature'] ?? req.headers['X-SalesCloser-Signature'];
    if (!provided) return false;
    const expected = createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async parseWebhook(req: WebhookRequest): Promise<VendorEvent> {
    if (!this.verifySignature(req)) throw new Error('Invalid SalesCloser webhook signature');
    const body = JSON.parse(req.rawBody) as {
      type: string;
      id: string;
      outcome?: string;
      occurred_at?: string;
    };
    const eventType = SC_EVENT_MAP[body.type];
    if (!eventType) throw new Error(`Unknown SalesCloser event type: ${body.type}`);
    return {
      vendor: 'salescloser',
      eventType,
      externalId: body.id,
      outcome: body.outcome ? SC_OUTCOME_MAP[body.outcome] : undefined,
      idempotencyKey: `salescloser-${body.id}-${body.type}`,
      payload: body,
      occurredAt: body.occurred_at ? new Date(body.occurred_at) : new Date(),
    };
  }
}
