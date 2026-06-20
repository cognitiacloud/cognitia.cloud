import { env } from '@cognitia/config';
import { MockVoiceAgentAdapter } from './mock';
import { SalesCloserAdapter } from './salescloser';
import { RetellAdapter, TwilioAdapter, VapiAdapter } from './stubs';
import type { VendorName, VoiceVendorAdapter } from './types';

export * from './types';
export { MockVoiceAgentAdapter } from './mock';
export { SalesCloserAdapter } from './salescloser';
export { RetellAdapter, TwilioAdapter, VapiAdapter } from './stubs';

/** Resolve a vendor adapter by name. MOCK_MODE always yields the mock. */
export function getVendorAdapter(name: VendorName = env.VENDOR_NAME): VoiceVendorAdapter {
  if (env.MOCK_MODE) return new MockVoiceAgentAdapter();
  switch (name) {
    case 'salescloser':
      return new SalesCloserAdapter();
    case 'vapi':
      return new VapiAdapter();
    case 'retell':
      return new RetellAdapter();
    case 'twilio':
      return new TwilioAdapter();
    case 'mock':
    default:
      return new MockVoiceAgentAdapter();
  }
}
