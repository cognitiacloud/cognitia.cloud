import { describe, it, expect } from 'vitest';
import { MockApifyClient } from './mock-client';

describe('MockApifyClient', () => {
  it('returns a succeeded run', async () => {
    const c = new MockApifyClient();
    const run = await c.startActor('apify/x', {});
    expect(run.status).toBe('succeeded');
    expect(run.datasetId).toBeTruthy();
  });

  it('returns fixture dataset items', async () => {
    const c = new MockApifyClient();
    const items = await c.fetchDataset('mock-dataset');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty('companyName');
  });
});
