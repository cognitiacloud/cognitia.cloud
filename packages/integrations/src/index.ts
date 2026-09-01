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
  type HubspotDeal,
  type HubspotPage,
} from './hubspot/client.js';
export {
  HubspotSyncService,
  type HubspotSyncSummary,
  type HubspotSyncDeps,
  type SyncEntityCounts,
} from './hubspot/sync.js';
export {
  HttpHubspotClient,
  HubspotApiError,
  PROVENANCE_PROPERTIES,
  type HttpHubspotClientOptions,
  type TokenProvider,
  type HttpFetch,
  type HttpResponse,
  type HttpRequestInit,
} from './hubspot/httpClient.js';
export {
  buildHubspotWritePlan,
  engagementContent,
  assembleEngagementProperties,
  provenanceProperties,
  DEFAULT_IDEMPOTENCY_PROPERTY,
  REQUIRED_ENGAGEMENT_PROPERTIES,
  type CrmWritePlan,
  type PlannableAction,
  type EngagementWrite,
} from './hubspot/writePlan.js';
export {
  checkHubspotReadiness,
  type ConnectionReadiness,
  type ReadinessCheck,
  type ReadinessInput,
} from './hubspot/readiness.js';
export { verifyHubspotSignatureV3, type VerifyHubspotSignatureInput } from './hubspot/webhook.js';
export {
  ConnectionTokenProvider,
  AesGcmSecretStore,
  InMemorySecretStore,
  InMemoryCiphertextStore,
  MissingCredentialError,
  TokenExpiredError,
  TokenRefreshError,
  type HubspotOAuthCredential,
  type SecretStore,
  type CiphertextStore,
  type ConnectionTokenProviderOptions,
} from './hubspot/tokenProvider.js';

export { executeSalesforceWrite } from './salesforce/write.js';
export { executeSalesforceRead } from './salesforce/read.js';
export { executeWebhookOutboundSideEffect } from './webhookOutbound.js';
