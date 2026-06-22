import { describe, it, expect } from 'vitest';
import {
  can,
  assertCan,
  permissionsForRole,
  PermissionDeniedError,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from './permissionModel.js';

describe('permissionModel.can', () => {
  it('viewer can read leads and proof but not act', () => {
    expect(can('viewer', 'view_lead')).toBe(true);
    expect(can('viewer', 'view_proof')).toBe(true);
    expect(can('viewer', 'approve_action')).toBe(false);
    expect(can('viewer', 'reject_action')).toBe(false);
    expect(can('viewer', 'configure_live_connector')).toBe(false);
  });

  it('operator may reject but not approve', () => {
    expect(can('operator', 'reject_action')).toBe(true);
    expect(can('operator', 'approve_action')).toBe(false);
    expect(can('operator', 'configure_live_connector')).toBe(false);
  });

  it('approver may approve and reject but not configure connectors', () => {
    expect(can('approver', 'approve_action')).toBe(true);
    expect(can('approver', 'reject_action')).toBe(true);
    expect(can('approver', 'configure_live_connector')).toBe(false);
  });

  it('admin holds every permission including connector config', () => {
    for (const p of PERMISSIONS) {
      expect(can('admin', p)).toBe(true);
    }
  });

  it('fails closed for unknown role', () => {
    expect(can('superuser', 'view_lead')).toBe(false);
    expect(can('', 'view_lead')).toBe(false);
  });

  it('fails closed for unknown permission', () => {
    expect(can('admin', 'delete_everything')).toBe(false);
    expect(can('admin', '')).toBe(false);
  });

  it('every role/permission pair is decidable', () => {
    for (const role of ROLES) {
      for (const perm of PERMISSIONS) {
        expect(typeof can(role, perm)).toBe('boolean');
      }
    }
  });
});

describe('permissionModel.assertCan', () => {
  it('does not throw when allowed', () => {
    expect(() => assertCan('admin', 'configure_live_connector')).not.toThrow();
  });

  it('throws PermissionDeniedError when denied', () => {
    expect(() => assertCan('viewer', 'approve_action')).toThrow(
      PermissionDeniedError,
    );
  });

  it('throws for unknown role/permission (fail closed)', () => {
    expect(() => assertCan('nobody', 'view_lead')).toThrow(PermissionDeniedError);
  });

  it('error carries role and permission', () => {
    try {
      assertCan('viewer', 'configure_live_connector');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionDeniedError);
      const e = err as PermissionDeniedError;
      expect(e.role).toBe('viewer');
      expect(e.permission).toBe('configure_live_connector');
    }
  });
});

describe('permissionModel.permissionsForRole', () => {
  it('returns least-privilege set for viewer', () => {
    const set = permissionsForRole('viewer');
    expect(set.has('view_lead' as Permission)).toBe(true);
    expect(set.has('approve_action' as Permission)).toBe(false);
  });

  it('returns empty set for unknown role', () => {
    expect(permissionsForRole('ghost' as Role).size).toBe(0);
  });
});
