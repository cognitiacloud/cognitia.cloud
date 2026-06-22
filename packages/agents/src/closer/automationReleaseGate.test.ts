import { describe, it, expect } from 'vitest';
import {
  evaluateAutomationReleaseGate,
  requiredConditionsFor,
  AUTOMATION_CONDITIONS,
  KILL_SWITCH_REASON,
  type AutomationReleaseInput,
} from './automationReleaseGate.js';

/** A fully-satisfied input that authorizes controlled live automation. */
const FULLY_AUTHORIZED: AutomationReleaseInput = {
  workspaceId: 'budget_wheels_demo',
  actionType: 'email',
  consentStatus: 'granted',
  approvalStatus: 'approved',
  connectorApproval: 'approved',
  secretsStatus: 'ready',
  rateLimitStatus: 'ok',
  monitoringStatus: 'active',
  rollbackStatus: 'ready',
  founderSignoff: true,
  legalSignoff: true,
  clientSignoff: true,
  killSwitch: false,
};

/** Inputs meeting only the dry-run prerequisites (no live conditions). */
const DRY_RUN_READY: AutomationReleaseInput = {
  workspaceId: 'budget_wheels_demo',
  actionType: 'email',
  consentStatus: 'granted',
  approvalStatus: 'approved',
};

describe('evaluateAutomationReleaseGate: fail closed', () => {
  it('blocks on empty input', () => {
    const r = evaluateAutomationReleaseGate({});
    expect(r.decision).toBe('blocked');
    expect(r.missingKeys).toContain('consentGranted');
    expect(r.missingKeys).toContain('humanApproval');
    expect(r.workspaceId).toBeNull();
    expect(r.actionType).toBeNull();
  });

  it('blocks with no argument at all', () => {
    expect(evaluateAutomationReleaseGate().decision).toBe('blocked');
  });

  it('treats unknown / pending statuses as not satisfied', () => {
    const r = evaluateAutomationReleaseGate({
      workspaceId: 'budget_wheels_demo',
      actionType: 'sms',
      consentStatus: 'pending',
      approvalStatus: 'pending',
    });
    expect(r.decision).toBe('blocked');
    expect(r.missingKeys).toEqual(['consentGranted', 'humanApproval']);
  });

  it('blocks when the workspace is unidentified (whitespace only)', () => {
    const r = evaluateAutomationReleaseGate({ ...DRY_RUN_READY, workspaceId: '   ' });
    expect(r.decision).toBe('blocked');
    expect(r.missingKeys).toContain('workspaceIdentified');
    expect(r.workspaceId).toBeNull();
  });

  it('blocks when the action type is missing', () => {
    const { actionType: _omit, ...noAction } = DRY_RUN_READY;
    const r = evaluateAutomationReleaseGate(noAction);
    expect(r.decision).toBe('blocked');
    expect(r.missingKeys).toContain('actionTyped');
  });
});

describe('evaluateAutomationReleaseGate: human review necessary but not sufficient', () => {
  it('approval alone (nothing else) is still blocked', () => {
    const r = evaluateAutomationReleaseGate({ approvalStatus: 'approved' });
    expect(r.decision).toBe('blocked');
    expect(r.satisfied).toContain('humanApproval');
    // identity + consent still missing
    expect(r.missingKeys).toContain('workspaceIdentified');
    expect(r.missingKeys).toContain('consentGranted');
  });

  it('full dry-run prerequisites reach ready_for_dry_run, never live', () => {
    const r = evaluateAutomationReleaseGate(DRY_RUN_READY);
    expect(r.decision).toBe('ready_for_dry_run');
    expect(r.satisfied).toEqual([
      'workspaceIdentified',
      'actionTyped',
      'consentGranted',
      'humanApproval',
    ]);
  });

  it('approval cannot by itself unlock controlled live even with every infra signal', () => {
    // Everything live-side is green, human approval present, but consent absent.
    const r = evaluateAutomationReleaseGate({
      ...FULLY_AUTHORIZED,
      consentStatus: 'pending',
    });
    expect(r.decision).toBe('blocked');
    expect(r.missingKeys).toEqual(['consentGranted']);
  });
});

describe('evaluateAutomationReleaseGate: ready_for_dry_run', () => {
  it('lists the live conditions still missing', () => {
    const r = evaluateAutomationReleaseGate(DRY_RUN_READY);
    expect(r.decision).toBe('ready_for_dry_run');
    expect(r.missingKeys).toEqual([
      'connectorApproved',
      'secretsReady',
      'rateLimitHealthy',
      'monitoringActive',
      'rollbackReady',
      'founderSignoff',
      'legalSignoff',
      'clientSignoff',
    ]);
    expect(r.missing).toContain('founder signoff');
  });

  it('stays at dry-run if any single live signoff is missing', () => {
    const r = evaluateAutomationReleaseGate({ ...FULLY_AUTHORIZED, legalSignoff: false });
    expect(r.decision).toBe('ready_for_dry_run');
    expect(r.missingKeys).toEqual(['legalSignoff']);
  });

  it('stays at dry-run if rate limit is exceeded', () => {
    const r = evaluateAutomationReleaseGate({ ...FULLY_AUTHORIZED, rateLimitStatus: 'exceeded' });
    expect(r.decision).toBe('ready_for_dry_run');
    expect(r.missingKeys).toEqual(['rateLimitHealthy']);
  });

  it('stays at dry-run if the connector is only pending', () => {
    const r = evaluateAutomationReleaseGate({ ...FULLY_AUTHORIZED, connectorApproval: 'pending' });
    expect(r.decision).toBe('ready_for_dry_run');
    expect(r.missingKeys).toEqual(['connectorApproved']);
  });
});

describe('evaluateAutomationReleaseGate: controlled_live_authorized', () => {
  it('authorizes when every condition is satisfied', () => {
    const r = evaluateAutomationReleaseGate(FULLY_AUTHORIZED);
    expect(r.decision).toBe('controlled_live_authorized');
    expect(r.missing).toEqual([]);
    expect(r.missingKeys).toEqual([]);
    expect(r.satisfied).toHaveLength(AUTOMATION_CONDITIONS.length);
    expect(r.workspaceId).toBe('budget_wheels_demo');
    expect(r.actionType).toBe('email');
  });

  it('trims surrounding whitespace on echoed identity', () => {
    const r = evaluateAutomationReleaseGate({
      ...FULLY_AUTHORIZED,
      workspaceId: '  budget_wheels_demo  ',
      actionType: '  email  ',
    });
    expect(r.decision).toBe('controlled_live_authorized');
    expect(r.workspaceId).toBe('budget_wheels_demo');
    expect(r.actionType).toBe('email');
  });
});

describe('evaluateAutomationReleaseGate: kill switch overrides everything', () => {
  it('blocks a fully-authorized input when the kill switch is engaged', () => {
    const r = evaluateAutomationReleaseGate({ ...FULLY_AUTHORIZED, killSwitch: true });
    expect(r.decision).toBe('blocked');
    expect(r.killSwitchEngaged).toBe(true);
    expect(r.missing).toEqual([KILL_SWITCH_REASON]);
    expect(r.missingKeys).toEqual([]);
  });

  it('blocks a dry-run-ready input when engaged', () => {
    const r = evaluateAutomationReleaseGate({ ...DRY_RUN_READY, killSwitch: true });
    expect(r.decision).toBe('blocked');
    expect(r.killSwitchEngaged).toBe(true);
  });

  it('still reports satisfied conditions while blocked by the kill switch', () => {
    const r = evaluateAutomationReleaseGate({ ...FULLY_AUTHORIZED, killSwitch: true });
    expect(r.satisfied).toHaveLength(AUTOMATION_CONDITIONS.length);
  });
});

describe('requiredConditionsFor', () => {
  it('returns only dry-run conditions for ready_for_dry_run', () => {
    expect(requiredConditionsFor('ready_for_dry_run')).toEqual([
      'workspaceIdentified',
      'actionTyped',
      'consentGranted',
      'humanApproval',
    ]);
  });

  it('returns every condition for controlled_live_authorized', () => {
    expect(requiredConditionsFor('controlled_live_authorized')).toEqual(
      AUTOMATION_CONDITIONS.map((c) => c.key),
    );
  });
});
