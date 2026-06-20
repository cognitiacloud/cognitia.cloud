import { createRequire } from 'node:module';
import type { ApifyClient, ApifyDatasetItem, StartActorResult } from './types';

const require = createRequire(import.meta.url);
const companies = require('../fixtures/companies.json') as ApifyDatasetItem[];

/** In-memory Apify client used in MOCK_MODE and tests. No network. */
export class MockApifyClient implements ApifyClient {
  async startActor(_actorId: string, _input: Record<string, unknown>): Promise<StartActorResult> {
    return {
      runId: `mock-run-${Date.now()}`,
      datasetId: 'mock-dataset',
      status: 'succeeded',
    };
  }

  async fetchDataset(_datasetId: string): Promise<ApifyDatasetItem[]> {
    return companies;
  }
}
