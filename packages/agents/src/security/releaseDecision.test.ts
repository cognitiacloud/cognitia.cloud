import { describe, it, expect } from 'vitest';
import { decideRelease, canAttemptLiveStage } from './releaseDecision.js';
import { SANDBOX_WORKSPACE_ID, type WorkspaceRef } from './workspaceIsolation.js';
import { ROLES, type Role } from './permissionModel.js';
import { type ReleaseConditions } from './releaseGate.js';

const SANDBOX: WorkspaceRef = { workspaceId: SANDBOX_WORKSPACE_ID, sandbox: true };

const ALL_LIVE: ReleaseConditions = {
  signedCustomerScope: true,
  counselSignoff: true,
  founderSignoff: true,
  monitoringEnabled: true,
  rollbackReady: true,
  secretsConfigured: true,
  connectorApproval: true,
};

describe('decideRelease: dry_run', () => {
  it('is allowed for any role in the sandbox with no conditions', () => {
    for (const role of ROLES) {
      const d = decideRelease({ role, stage: 'dry_run', workspace: SANDBOX });
      expect(d.allowed).toBe(true);
      expect(d.blockers).toEqual([]);
    }
  });

  it('is denied outside the sandbox even for admin', () => {
    const d = decideRelease({
      role: 'admin',
      stage: 'dry_run',
      workspace: { workspaceId: 'acme_corp', sandbox: false },
    });
    expect(d.allowed).toBe(false);
    expect(d.workspaceOk).toBe(false);
  });
});

describe('decideRelease: controlled_live fails closed', () => {
  it('FAILS CLOSED for admin when no conditions are attested', () => {
    const d = decideRelease({ role: 'admin', stage: 'controlled_live', workspace: SANDBOX });
    expect(d.allowed).toBe(false);
    expect(d.permissionOk).toBe(true); // admin has the permission…
    expect(d.gateOk).toBe(false); // …but the gate is unmet.
    expect(d.blockers.join(' ')).toMatch(/blocked: missing/);
  });

  it('FAILS CLOSED when all conditions are met but the role lacks permission', () => {
    for (const role of ['viewer', 'operator', 'approver'] as Role[]) {
      const d = decideRelease({
        role,
        stage: 'controlled_live',
        conditions: ALL_LIVE,
        workspace: SANDBOX,
      });
      expect(d.allowed).toBe(false);
      expect(d.permissionOk).toBe(false);
      expect(d.gateOk).toBe(true);
      expect(d.blockers.join(' ')).toMatch(/lacks "configure_live_connector"/);
    }
  });

  it('FAILS CLOSED when permission + conditions hold but workspace is not the sandbox', () => {
    const d = decideRelease({
      role: 'admin',
      stage: 'controlled_live',
      conditions: ALL_LIVE,
      workspace: { workspaceId: 'acme_corp', sandbox: false },
    });
    expect(d.allowed).toBe(false);
    expect(d.permissionOk).toBe(true);
    expect(d.gateOk).toBe(true);
    expect(d.workspaceOk).toBe(false);
  });

  it('FAILS CLOSED if ANY single one of the seven conditions is missing', () => {
    for (const key of Object.keys(ALL_LIVE) as Array<keyof ReleaseConditions>) {
      const conditions: ReleaseConditions = { ...ALL_LIVE, [key]: false };
      const d = decideRelease({
        role: 'admin',
        stage: 'controlled_live',
        conditions,
        workspace: SANDBOX,
      });
      expect(d.allowed).toBe(false);
      expect(d.gateOk).toBe(false);
    }
  });

  it('is ALLOWED only when role + all 7 conditions + sandbox hold together', () => {
    const d = decideRelease({
      role: 'admin',
      stage: 'controlled_live',
      conditions: ALL_LIVE,
      workspace: SANDBOX,
    });
    expect(d.allowed).toBe(true);
    expect(d.permissionOk).toBe(true);
    expect(d.gateOk).toBe(true);
    expect(d.workspaceOk).toBe(true);
    expect(d.blockers).toEqual([]);
  });

  it('reports every blocker at once (does not short-circuit)', () => {
    // approver (no perm) + no conditions + non-sandbox => all three checks fail.
    const d = decideRelease({
      role: 'approver',
      stage: 'controlled_live',
      workspace: { workspaceId: 'acme_corp', sandbox: false },
    });
    expect(d.allowed).toBe(false);
    expect(d.permissionOk).toBe(false);
    expect(d.gateOk).toBe(false);
    expect(d.workspaceOk).toBe(false);
    expect(d.blockers.length).toBeGreaterThanOrEqual(3);
  });
});

describe('decideRelease: unknown stage fails closed', () => {
  it('denies an invented stage even with everything attested', () => {
    const d = decideRelease({
      role: 'admin',
      stage: 'go_live_now',
      conditions: ALL_LIVE,
      workspace: SANDBOX,
    });
    expect(d.allowed).toBe(false);
    expect(d.gateOk).toBe(false);
  });
});

describe('canAttemptLiveStage', () => {
  it('is true only for admin', () => {
    expect(canAttemptLiveStage('admin')).toBe(true);
    expect(canAttemptLiveStage('approver')).toBe(false);
    expect(canAttemptLiveStage('operator')).toBe(false);
    expect(canAttemptLiveStage('viewer')).toBe(false);
  });
});
