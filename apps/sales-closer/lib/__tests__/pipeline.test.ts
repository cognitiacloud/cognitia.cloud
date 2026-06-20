/**
 * End-to-end pipeline integration tests.
 *
 * These run only when TEST_DATABASE_URL points at a disposable Postgres (the
 * suite drops and recreates the public schema). In CI without a database they
 * skip, keeping `turbo run test` green. Locally:
 *
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/sales_closer \
 *     pnpm --filter @cognitia/sales-closer test
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const TEST_DB = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = TEST_DB ?? process.env.DATABASE_URL;
process.env.MOCK_MODE = 'true';

const run = TEST_DB ? describe : describe.skip;

run('sales closer pipeline', () => {
  // Imported lazily so env is set before the db singleton initializes.
  let mod: typeof import('./pipeline-harness');

  beforeAll(async () => {
    mod = await import('./pipeline-harness');
    await mod.resetSchema();
    await mod.seedMinimal();
  });

  afterAll(async () => {
    await mod?.close();
  });

  it('scores an account idempotently on its signals hash', async () => {
    const first = await mod.scoreFixture();
    const second = await mod.scoreFixture();
    expect(second.id).toBe(first.id); // no new row for identical signals
  });

  it('generates a closer brief', async () => {
    const brief = await mod.briefFixture();
    expect(brief.painPoints.length).toBeGreaterThan(0);
    expect(brief.version).toBeGreaterThanOrEqual(1);
  });

  it('approving a draft writes a compliance log', async () => {
    const before = await mod.complianceCount();
    await mod.approveFixtureDraft();
    const after = await mod.complianceCount();
    expect(after).toBeGreaterThan(before);
  });

  it('creates a vendor lead from the approved draft', async () => {
    const event = await mod.createLeadFromFixtureDraft();
    expect(event.eventType).toBe('lead_created');
    expect(event.externalId).toBeTruthy();
  });

  it('processes a webhook once and treats duplicates as no-ops', async () => {
    const a = await mod.deliverWebhook('booked_meeting', 'idem-1');
    const b = await mod.deliverWebhook('booked_meeting', 'idem-1');
    expect(a).toEqual({ processed: true, duplicate: false });
    expect(b).toEqual({ processed: false, duplicate: true });
    expect(await mod.eventCountFor('idem-1')).toBe(1);
  });

  it('a DNC webhook suppresses the contact', async () => {
    await mod.deliverDncWebhook();
    expect(await mod.fixtureContactConsent()).toBe('dnc');
  });
});
