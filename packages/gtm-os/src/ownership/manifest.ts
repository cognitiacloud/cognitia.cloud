/**
 * Ownership manifest for the Proof-Governed GTM OS v0 work lanes ("W lanes").
 *
 * This is the machine-readable boundary map: it records which lane owns which
 * file paths, so this substrate stays inside its own lane and never edits a path
 * owned by another in-flight PR. The `this-pr` lane is the only one this PR may
 * write to; every other entry is documented purely to mark a boundary.
 *
 * PR truth encoded here (per the v0 charter):
 *   - #135 is the canonical W1 Sales Closer workflow core.
 *   - #124 is parked (salvage only the idempotent-mock-CRM idea; do not recreate).
 *   - #138 Operator Console is green but sequencing-held.
 *   - #139 / #140 / #142 are specs/artifacts, not runtime.
 *   - #136 / #141 need a base/CI decision (they target ep002, not main).
 */

export type LaneStatus =
  | 'this-pr'
  | 'canonical'
  | 'parked'
  | 'sequencing-held'
  | 'spec'
  | 'needs-base-decision';

export interface LaneOwnership {
  lane: string;
  owner: string;
  status: LaneStatus;
  pr: string | null;
  /** Base branch when it matters (e.g. not `main`). */
  base: string | null;
  /** Owned path globs. `**` = subtree, trailing `.*` = filename prefix. */
  paths: string[];
  note: string;
}

export const OWNERSHIP_MANIFEST: LaneOwnership[] = [
  {
    lane: 'W0-substrate',
    owner: 'packages/gtm-os (this package)',
    status: 'this-pr',
    pr: null,
    base: 'main',
    paths: ['packages/gtm-os/**', 'docs/gtm-os/**'],
    note: 'Proof-Governed GTM OS v0 substrate. The only lane this PR writes to.',
  },
  {
    lane: 'W1-sales-closer-core',
    owner: '#135',
    status: 'canonical',
    pr: '#135',
    base: 'main',
    paths: ['packages/agents/src/closer/**', 'packages/agents/src/index.ts'],
    note: 'Canonical W1 workflow core. Do NOT edit here; reconcile via a later PR.',
  },
  {
    lane: 'W1-parked',
    owner: '#124',
    status: 'parked',
    pr: '#124',
    base: 'main',
    paths: ['packages/agents/src/closer/**'],
    note: 'Parked. Salvaged only the idempotent mock-CRM idea (reimplemented in W0).',
  },
  {
    lane: 'W4-operator-console',
    owner: '#138',
    status: 'sequencing-held',
    pr: '#138',
    base: 'main',
    paths: ['apps/web/src/app/operator/**', 'apps/web/src/lib/operatorConsole.*'],
    note: 'Green but sequencing-held. Operator UI route lives here, not in W0.',
  },
  {
    lane: 'spec-proof-receipt',
    owner: '#140',
    status: 'spec',
    pr: '#140',
    base: 'main',
    paths: ['docs/architecture/proof-receipt-spec.md'],
    note: 'Spec/artifact. W0 implements a compatible runtime receipt.',
  },
  {
    lane: 'spec-trustops-analytics',
    owner: '#139',
    status: 'spec',
    pr: '#139',
    base: 'main',
    paths: ['docs/architecture/trustops-analytics.md'],
    note: 'Spec/artifact only.',
  },
  {
    lane: 'spec-build-reconciliation',
    owner: '#142',
    status: 'spec',
    pr: '#142',
    base: 'main',
    paths: ['docs/execution/client-zero-build-reconciliation.md'],
    note: 'Spec/artifact only.',
  },
  {
    lane: 'spec-agent-action-passport',
    owner: '#136',
    status: 'needs-base-decision',
    pr: '#136',
    base: 'claude/ep002-mission-run-pPoba',
    paths: ['docs/architecture/agent-action-passport.md'],
    note: 'Targets ep002, not main. Needs base/CI decision; do not retarget.',
  },
  {
    lane: 'spec-dispute-replay-pack',
    owner: '#141',
    status: 'needs-base-decision',
    pr: '#141',
    base: 'claude/ep002-mission-run-pPoba',
    paths: ['docs/architecture/dispute-replay-pack.md'],
    note: 'Targets ep002, not main. Needs base/CI decision; do not retarget.',
  },
];

function pathMatches(owned: string, candidate: string): boolean {
  if (owned.endsWith('/**')) {
    const prefix = owned.slice(0, -2); // keep trailing '/'
    return candidate === prefix.slice(0, -1) || candidate.startsWith(prefix);
  }
  if (owned.endsWith('.*')) {
    return candidate.startsWith(owned.slice(0, -1));
  }
  return owned === candidate;
}

export function thisPrLanes(): LaneOwnership[] {
  return OWNERSHIP_MANIFEST.filter((l) => l.status === 'this-pr');
}

export function thisPrPaths(): string[] {
  return thisPrLanes().flatMap((l) => l.paths);
}

export function externalOwnedPaths(): string[] {
  return OWNERSHIP_MANIFEST.filter((l) => l.status !== 'this-pr').flatMap((l) => l.paths);
}

export function ownerOfPath(path: string): LaneOwnership | null {
  return OWNERSHIP_MANIFEST.find((lane) => lane.paths.some((p) => pathMatches(p, path))) ?? null;
}

/**
 * Returns any externally-owned path that falls under a this-PR path — i.e. a
 * real ownership collision. Expected to be empty; asserted by the manifest test.
 */
export function findManifestOverlaps(): { path: string; owner: string }[] {
  const mine = thisPrPaths();
  const overlaps: { path: string; owner: string }[] = [];
  for (const lane of OWNERSHIP_MANIFEST) {
    if (lane.status === 'this-pr') continue;
    for (const path of lane.paths) {
      const concrete = path.replace(/\/\*\*$/, '').replace(/\.\*$/, '');
      if (mine.some((m) => pathMatches(m, concrete))) {
        overlaps.push({ path, owner: lane.owner });
      }
    }
  }
  return overlaps;
}
