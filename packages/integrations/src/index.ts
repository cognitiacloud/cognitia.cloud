export * from './types.js';
export * from './provider.js';
export * from './registry.js';
export { StubEmailAdapter } from './email/adapter.js';
export { StubHubspotAdapter } from './hubspot/adapter.js';
export { HubspotProvider } from './hubspot/provider.js';
export {
  FakeHubspotClient,
  type HubspotClient,
  type HubspotWriteInput,
  type HubspotWriteResult,
  type HubspotCompany,
  type HubspotContact,
  type HubspotPage,
} from './hubspot/client.js';
