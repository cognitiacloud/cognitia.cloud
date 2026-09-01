import { describe, it, expect } from 'vitest';
import { LIVE_SURFACE_DENIED } from '@cognitia/core';
import { runOutboundWorkerPost } from './outbound.js';

describe('CGD-001 worker outbound post', () => {
  it('denies before the job body runs', async () => {
    let ran = 0;
    await expect(
      runOutboundWorkerPost('hubspot', async () => {
        ran += 1;
        return 'sent';
      }),
    ).rejects.toMatchObject({
      code: LIVE_SURFACE_DENIED,
      outbound: false,
      surface: 'hubspot',
    });
    expect(ran).toBe(0);
  });
});
