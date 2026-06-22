import { describe, expect, it } from 'vitest';
import { renderDemo, runApprovedDemo, runBlockedDemo } from './runHappyPath.js';

/**
 * Runnable, observable demo: `pnpm --filter @cognitia/gtm-os demo` runs this
 * file and prints the operator timeline for an approved and a blocked path.
 */
describe('mock-only end-to-end demo', () => {
  it('approved path completes with verified integrity and no raw PII', () => {
    const report = runApprovedDemo('lead_bw_001');
    expect(report.outcome).toBe('completed');
    expect(report.approval?.status).toBe('approved');
    expect(report.integrity.ledgerValid).toBe(true);
    expect(report.integrity.receiptChainValid).toBe(true);
    expect(report.noRawPii).toBe(true);
  });

  it('blocked path stops at blocked with a reason and no writeback', () => {
    const report = runBlockedDemo('lead_bw_002');
    expect(report.outcome).toBe('blocked');
    expect(report.blockedReasons).toContain('consent_missing');
    expect(report.idempotencyKeys).toEqual([]);
  });

  it('renders an operator timeline for both paths', () => {
    const out = renderDemo();
    expect(out).toContain('Proof timeline');
    // Surface the demo output when this file is run directly.
    process.stdout.write(`\n${out}\n`);
  });
});
