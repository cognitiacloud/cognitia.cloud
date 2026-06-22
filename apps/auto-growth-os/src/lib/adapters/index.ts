// lib/adapters/index.ts
// The single swap seam. To go live, implement a real adapter against the matching
// interface in ./types.ts and replace the Mock* instance below — nothing else
// changes. Env vars for each integration are documented in .env.example.

import type { AdapterRegistry } from './types';
import { MockWhatsAppAdapter } from './whatsapp';
import { MockCrmAdapter } from './crm';
import { MockAdsReportingAdapter } from './ads';
import { MockAiAgentAdapter } from './ai';
import { MockMessagingAdapter } from './emailSms';

export const adapters: AdapterRegistry = {
  whatsapp: new MockWhatsAppAdapter(),
  crm: new MockCrmAdapter(),
  ads: new MockAdsReportingAdapter(),
  ai: new MockAiAgentAdapter(),
  messaging: new MockMessagingAdapter(),
};

/** True while integrations are simulated. Wire to env in production. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

export * from './types';
