import { describe, it, expect } from 'vitest';
import {
  buildPermissionMatrix,
  buildReleaseGateMatrix,
  renderMatrixMarkdown,
} from './permissionMatrix.js';
import { ROLES, PERMISSIONS, can } from './permissionModel.js';
import { RELEASE_STAGES, requiredConditions } from './releaseGate.js';

describe('buildPermissionMatrix', () => {
  it('has one row per role and one cell per permission', () => {
    const matrix = buildPermissionMatrix();
    expect(matrix.map((r) => r.role)).toEqual([...ROLES]);
    for (const row of matrix) {
      expect(Object.keys(row.permissions).sort()).toEqual([...PERMISSIONS].sort());
    }
  });

  it('agrees cell-for-cell with the live can() function (no drift)', () => {
    for (const row of buildPermissionMatrix()) {
      for (const permission of PERMISSIONS) {
        expect(row.permissions[permission]).toBe(can(row.role, permission));
      }
    }
  });

  it('is least-privilege monotone (viewer ⊆ operator ⊆ approver ⊆ admin)', () => {
    const granted = (role: (typeof ROLES)[number]) =>
      new Set(PERMISSIONS.filter((p) => can(role, p)));
    const pairs = [
      ['viewer', 'operator'],
      ['operator', 'approver'],
      ['approver', 'admin'],
    ] as const;
    for (const [lowerRole, higherRole] of pairs) {
      const lower = granted(lowerRole);
      const higher = granted(higherRole);
      for (const p of lower) {
        expect(higher.has(p)).toBe(true);
      }
    }
  });

  it('grants configure_live_connector to admin only', () => {
    const holders = ROLES.filter((r) => can(r, 'configure_live_connector'));
    expect(holders).toEqual(['admin']);
  });
});

describe('buildReleaseGateMatrix', () => {
  it('has one row per stage matching requiredConditions()', () => {
    const matrix = buildReleaseGateMatrix();
    expect(matrix.map((r) => r.stage)).toEqual([...RELEASE_STAGES]);
    for (const row of matrix) {
      expect(row.required).toEqual([...requiredConditions(row.stage)]);
      expect(row.requiredLabels).toHaveLength(row.required.length);
    }
  });

  it('shows controlled_live requiring all seven conditions', () => {
    const row = buildReleaseGateMatrix().find((r) => r.stage === 'controlled_live');
    expect(row?.required).toHaveLength(7);
  });
});

describe('renderMatrixMarkdown', () => {
  it('renders deterministic markdown referencing both source modules', () => {
    const md = renderMatrixMarkdown();
    expect(md).toContain('permissionModel.ts');
    expect(md).toContain('releaseGate.ts');
    expect(md).toContain('| admin |');
    expect(md).toContain('`controlled_live`');
    // Stable output: rendering twice yields identical text.
    expect(renderMatrixMarkdown()).toBe(md);
  });
});
