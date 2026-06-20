import { env } from '@cognitia/config';
import { MockApifyClient } from './mock-client';
import { RealApifyClient } from './real-client';
import type { ApifyClient } from './types';

export * from './types';
export { MockApifyClient } from './mock-client';
export { RealApifyClient } from './real-client';

/** Resolve the active Apify client. MOCK_MODE forces fixtures. */
export function getApifyClient(): ApifyClient {
  return env.MOCK_MODE ? new MockApifyClient() : new RealApifyClient();
}
