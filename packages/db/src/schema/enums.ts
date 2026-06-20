import { pgEnum } from 'drizzle-orm/pg-core';

export const scrapeRunStatus = pgEnum('scrape_run_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'partial',
]);

export const signalType = pgEnum('signal_type', [
  'tech_stack',
  'hiring',
  'funding',
  'traffic',
  'review',
  'social',
  'news',
  'website_audit',
]);

export const outreachChannel = pgEnum('outreach_channel', ['email', 'linkedin', 'voice', 'sms']);

export const draftStatus = pgEnum('draft_status', [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'sent',
]);

export const vendorName = pgEnum('vendor_name', [
  'salescloser',
  'vapi',
  'retell',
  'twilio',
  'mock',
]);

export const vendorEventType = pgEnum('vendor_event_type', [
  'lead_created',
  'call_scheduled',
  'call_started',
  'call_completed',
  'call_failed',
  'voicemail',
  'callback_requested',
  'dnc_requested',
]);

export const callOutcome = pgEnum('call_outcome', [
  'connected',
  'no_answer',
  'voicemail',
  'booked_meeting',
  'not_interested',
  'callback',
  'wrong_number',
  'dnc',
]);

export const consentStatus = pgEnum('consent_status', ['unknown', 'opted_in', 'opted_out', 'dnc']);

export const syncDirection = pgEnum('sync_direction', ['outbound', 'inbound']);
