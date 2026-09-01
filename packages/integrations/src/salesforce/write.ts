import { assertLiveOutboundAllowed } from '@cognitia/core';

/**
 * Salesforce write entry. There is no live Salesforce adapter in this repo
 * (env placeholders only). CGD-001: secrets (SALESFORCE_CLIENT_SECRET) MUST
 * NOT write. Gate runs BEFORE any client or fetch is constructed.
 */
export async function executeSalesforceWrite(_input: {
  operation: string;
  payload: Record<string, unknown>;
}): Promise<never> {
  assertLiveOutboundAllowed('salesforce');
  throw new Error('Salesforce write adapter is not implemented; live writes remain denied');
}
