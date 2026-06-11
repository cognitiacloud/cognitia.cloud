import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * TRUTH-1 — machine-readable truth report guard. docs/truth-report.json is the
 * single source of truth for what is implemented / partial / blocked-externally
 * / unverified. This test makes the artifact honest by construction:
 *   - every status is in the closed enum;
 *   - every evidence pointer resolves to a real file in the repo (so a renamed
 *     or deleted test fails CI until the report is corrected);
 *   - implemented/partial capabilities must cite at least one piece of evidence;
 *   - blocked_external capabilities must name a blocker AND an unblock step;
 *   - unverified capabilities must give a reason;
 *   - the summary counts must equal the actual capabilities.
 * If any of these drift, the build fails — the report cannot quietly lie.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const STATUSES = ['implemented', 'partial', 'blocked_external', 'unverified'] as const;
type Status = (typeof STATUSES)[number];

interface Capability {
  id: string;
  title: string;
  status: Status;
  summary: string;
  evidence?: string[];
  blocker?: string;
  unblock?: string;
  reason?: string;
}
interface TruthReport {
  schema_version: number;
  as_of: string;
  summary: Record<Status | 'total', number>;
  capabilities: Capability[];
}

function load(): TruthReport {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'docs/truth-report.json'), 'utf8')) as TruthReport;
}

describe('TRUTH-1 — docs/truth-report.json is internally honest', () => {
  it('every capability has a valid status and non-empty id/title/summary', () => {
    const report = load();
    expect(report.capabilities.length).toBeGreaterThan(0);
    const ids = new Set<string>();
    for (const cap of report.capabilities) {
      expect(STATUSES, `bad status for ${cap.id}`).toContain(cap.status);
      expect(cap.id.length, 'capability id must be non-empty').toBeGreaterThan(0);
      expect(cap.title.length, `title missing for ${cap.id}`).toBeGreaterThan(0);
      expect(cap.summary.length, `summary missing for ${cap.id}`).toBeGreaterThan(0);
      expect(ids.has(cap.id), `duplicate capability id: ${cap.id}`).toBe(false);
      ids.add(cap.id);
    }
  });

  it('every cited evidence pointer resolves to a real file', () => {
    const report = load();
    for (const cap of report.capabilities) {
      for (const path of cap.evidence ?? []) {
        expect(existsSync(join(REPO_ROOT, path)), `missing evidence for ${cap.id}: ${path}`).toBe(
          true,
        );
      }
    }
  });

  it('implemented/partial cite evidence; blocked name a blocker+unblock; unverified give a reason', () => {
    const report = load();
    for (const cap of report.capabilities) {
      if (cap.status === 'implemented' || cap.status === 'partial') {
        expect((cap.evidence ?? []).length, `${cap.id} must cite evidence`).toBeGreaterThan(0);
      }
      if (cap.status === 'blocked_external') {
        expect((cap.blocker ?? '').length, `${cap.id} must name a blocker`).toBeGreaterThan(0);
        expect((cap.unblock ?? '').length, `${cap.id} must name an unblock step`).toBeGreaterThan(
          0,
        );
      }
      if (cap.status === 'unverified') {
        expect((cap.reason ?? '').length, `${cap.id} must give a reason`).toBeGreaterThan(0);
      }
    }
  });

  it('the summary counts equal the actual capabilities', () => {
    const report = load();
    const counts: Record<Status, number> = {
      implemented: 0,
      partial: 0,
      blocked_external: 0,
      unverified: 0,
    };
    for (const cap of report.capabilities) counts[cap.status] += 1;
    for (const status of STATUSES) {
      expect(report.summary[status], `summary.${status} is wrong`).toBe(counts[status]);
    }
    expect(report.summary.total, 'summary.total is wrong').toBe(report.capabilities.length);
  });
});
