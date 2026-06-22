import { describe, expect, it } from 'vitest';
import {
  externalOwnedPaths,
  findManifestOverlaps,
  OWNERSHIP_MANIFEST,
  ownerOfPath,
  thisPrPaths,
} from './manifest.js';

describe('ownership manifest', () => {
  it('this-PR paths do not overlap any externally-owned path', () => {
    expect(findManifestOverlaps()).toEqual([]);
  });

  it('routes substrate, canonical, and console paths to the right lanes', () => {
    expect(ownerOfPath('packages/gtm-os/src/index.ts')?.lane).toBe('W0-substrate');
    expect(ownerOfPath('docs/gtm-os/README.md')?.status).toBe('this-pr');
    expect(ownerOfPath('packages/agents/src/closer/index.ts')?.status).toBe('canonical');
    expect(ownerOfPath('apps/web/src/app/operator/page.tsx')?.pr).toBe('#138');
  });

  it('records the canonical (#135), parked (#124), and base-decision (#136/#141) PRs', () => {
    const prs = OWNERSHIP_MANIFEST.map((l) => l.pr);
    expect(prs).toContain('#135');
    expect(prs).toContain('#124');
    expect(prs).toContain('#138');
    const ep002 = OWNERSHIP_MANIFEST.filter((l) => l.base === 'claude/ep002-mission-run-pPoba').map(
      (l) => l.pr,
    );
    expect([...ep002].sort()).toEqual(['#136', '#141']);
  });

  it('separates this-PR paths from external paths', () => {
    expect(thisPrPaths()).toContain('packages/gtm-os/**');
    expect(externalOwnedPaths()).toContain('packages/agents/src/closer/**');
    expect(externalOwnedPaths()).not.toContain('packages/gtm-os/**');
  });
});
