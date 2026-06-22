/**
 * Mock-safe enterprise-readiness primitive: a PROGRAMMATIC control matrix.
 *
 * STATUS: MOCK / SANDBOX. This derives the permission/role and release-gate
 * matrices directly from the canonical local primitives so that documentation
 * cannot silently drift from the enforced code. It is descriptive only: it reads
 * the model, it does not enforce anything and makes no production-readiness
 * claim. The single source of truth remains `permissionModel.ts` and
 * `releaseGate.ts`; this module just renders them.
 */

import { ROLES, PERMISSIONS, can, type Permission, type Role } from './permissionModel.js';
import {
  RELEASE_STAGES,
  CONDITION_LABELS,
  requiredConditions,
  type ReleaseConditions,
  type ReleaseStage,
} from './releaseGate.js';

/** One row of the role → permission matrix. */
export interface PermissionMatrixRow {
  role: Role;
  /** permission -> granted? derived from the live `can()` function. */
  permissions: Record<Permission, boolean>;
}

/** Build the role → permission matrix straight from `can()`. */
export function buildPermissionMatrix(): PermissionMatrixRow[] {
  return ROLES.map((role) => {
    const permissions = {} as Record<Permission, boolean>;
    for (const permission of PERMISSIONS) {
      permissions[permission] = can(role, permission);
    }
    return { role, permissions };
  });
}

/** One row of the stage → required-conditions matrix. */
export interface ReleaseGateMatrixRow {
  stage: ReleaseStage;
  /** Condition keys required for the stage, in canonical order. */
  required: Array<keyof ReleaseConditions>;
  /** Human labels for the required conditions. */
  requiredLabels: string[];
}

/** Build the stage → required-conditions matrix straight from `requiredConditions()`. */
export function buildReleaseGateMatrix(): ReleaseGateMatrixRow[] {
  return RELEASE_STAGES.map((stage) => {
    const required = [...requiredConditions(stage)];
    return {
      stage,
      required,
      requiredLabels: required.map((key) => CONDITION_LABELS[key]),
    };
  });
}

/** Render both matrices as GitHub-flavoured markdown tables. Deterministic. */
export function renderMatrixMarkdown(): string {
  const permRows = buildPermissionMatrix();
  const header = `| Role | ${PERMISSIONS.join(' | ')} |`;
  const divider = `| --- | ${PERMISSIONS.map(() => ':---:').join(' | ')} |`;
  const permLines = permRows.map((row) => {
    const cells = PERMISSIONS.map((p) => (row.permissions[p] ? 'y' : '-'));
    return `| ${row.role} | ${cells.join(' | ')} |`;
  });

  const gateRows = buildReleaseGateMatrix();
  const gateLines = gateRows.map((row) => {
    const conds = row.requiredLabels.length > 0 ? row.requiredLabels.join(', ') : '(none)';
    return `| \`${row.stage}\` | ${conds} |`;
  });

  return [
    '### Permission matrix (generated from `permissionModel.ts`)',
    '',
    header,
    divider,
    ...permLines,
    '',
    '### Release-gate matrix (generated from `releaseGate.ts`)',
    '',
    '| Stage | Required conditions |',
    '| --- | --- |',
    ...gateLines,
    '',
  ].join('\n');
}
