// lib/adapters/emailSms.ts
import type { AdapterResult } from '../../types';
import type { MessagingAdapter } from './types';

/**
 * Simulated email/SMS adapter. Production: implement against providers such as
 * Resend/SendGrid (email) and Twilio (SMS) behind this interface. Consent and
 * unsubscribe are enforced by the caller before this is ever reached.
 */
export class MockMessagingAdapter implements MessagingAdapter {
  async send(channel: 'email' | 'sms', to: string, body: string): Promise<AdapterResult> {
    console.info(`[${channel.toUpperCase()}:SIMULATED]`, { to, body });
    return {
      ok: true,
      simulated: true,
      detail: `Would send ${channel.toUpperCase()} to ${to}`,
    };
  }
}
