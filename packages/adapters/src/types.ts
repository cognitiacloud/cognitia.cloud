export type VendorName = 'salescloser' | 'vapi' | 'retell' | 'twilio' | 'mock';

export type VendorEventType =
  | 'lead_created'
  | 'call_scheduled'
  | 'call_started'
  | 'call_completed'
  | 'call_failed'
  | 'voicemail'
  | 'callback_requested'
  | 'dnc_requested';

export type CallOutcome =
  | 'connected'
  | 'no_answer'
  | 'voicemail'
  | 'booked_meeting'
  | 'not_interested'
  | 'callback'
  | 'wrong_number'
  | 'dnc';

export interface CreateLeadInput {
  accountId: string;
  contactId: string;
  fullName: string;
  phone?: string;
  email?: string;
  briefSummary?: string;
}

export interface VendorLead {
  externalId: string;
  status: string;
}

export interface ScheduleCallInput {
  leadExternalId: string;
  scheduledFor: Date;
}

export interface VendorCall {
  externalId: string;
  status: string;
  scheduledFor?: Date;
}

export interface WebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
}

export interface VendorEvent {
  vendor: VendorName;
  eventType: VendorEventType;
  externalId: string;
  outcome?: CallOutcome;
  idempotencyKey: string;
  payload: unknown;
  occurredAt: Date;
}

/**
 * Single seam between the engine and any voice/closer vendor. Swapping
 * SalesCloser for Vapi/Retell/Twilio means writing a new implementation —
 * no route or UI changes.
 */
export interface VoiceVendorAdapter {
  readonly name: VendorName;
  createLead(input: CreateLeadInput): Promise<VendorLead>;
  scheduleCall(input: ScheduleCallInput): Promise<VendorCall>;
  getCall(externalId: string): Promise<VendorCall>;
  verifySignature(req: WebhookRequest): boolean;
  parseWebhook(req: WebhookRequest): Promise<VendorEvent>;
}
