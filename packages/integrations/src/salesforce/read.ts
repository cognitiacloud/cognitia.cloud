import { assertLiveOutboundAllowed } from '@cognitia/core';

/**
 * Salesforce read entry. There is no live Salesforce adapter in this repo
 * (env placeholders only). CGD-002: secrets (SALESFORCE_CLIENT_SECRET) MUST
 * NOT read vendor HTTP. Gate runs BEFORE any client or fetch is constructed.
 */
export async function executeSalesforceRead(_input: {
  operation: string;
  query?: Record<string, unknown>;
}): Promise<never> {
  assertLiveOutboundAllowed('salesforceRead');
  throw new Error('Salesforce read adapter is not implemented; live reads remain denied');
}
