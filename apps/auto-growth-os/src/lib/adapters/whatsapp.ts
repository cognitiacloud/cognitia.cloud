// lib/adapters/whatsapp.ts
import type { AdapterResult } from '../../types';
import type { WhatsAppAdapter } from './types';

/**
 * Simulated WhatsApp adapter. Logs intent and returns a simulated result.
 * Production: implement `WhatsAppCloudAdapter implements WhatsAppAdapter` against
 * the WhatsApp Cloud API and swap it in lib/adapters/index.ts.
 */
export class MockWhatsAppAdapter implements WhatsAppAdapter {
  async sendMessage(
    to: string,
    body: string,
    opts?: { templateId?: string },
  ): Promise<AdapterResult> {
    console.info('[WhatsApp:SIMULATED]', { to, body, ...opts });
    return {
      ok: true,
      simulated: true,
      detail: `Would send WhatsApp message to ${to}: "${truncate(body)}"`,
    };
  }
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
