import type {
  CreateLeadInput,
  ScheduleCallInput,
  VendorCall,
  VendorEvent,
  VendorLead,
  VendorName,
  VoiceVendorAdapter,
  WebhookRequest,
} from './types';

/**
 * Future-vendor stubs. They implement the interface so the factory and the
 * call sites compile, but every method throws until the integration is built.
 * This proves the adapter seam works for additional vendors.
 */
class StubAdapter implements VoiceVendorAdapter {
  constructor(readonly name: VendorName) {}
  private notImplemented(): never {
    throw new Error(`${this.name} adapter is not implemented yet`);
  }
  createLead(_input: CreateLeadInput): Promise<VendorLead> {
    return this.notImplemented();
  }
  scheduleCall(_input: ScheduleCallInput): Promise<VendorCall> {
    return this.notImplemented();
  }
  getCall(_externalId: string): Promise<VendorCall> {
    return this.notImplemented();
  }
  verifySignature(_req: WebhookRequest): boolean {
    return this.notImplemented();
  }
  parseWebhook(_req: WebhookRequest): Promise<VendorEvent> {
    return this.notImplemented();
  }
}

// TODO(vendor): implement against the Vapi API.
export class VapiAdapter extends StubAdapter {
  constructor() {
    super('vapi');
  }
}

// TODO(vendor): implement against the Retell API.
export class RetellAdapter extends StubAdapter {
  constructor() {
    super('retell');
  }
}

// TODO(vendor): implement against Twilio Programmable Voice.
export class TwilioAdapter extends StubAdapter {
  constructor() {
    super('twilio');
  }
}
