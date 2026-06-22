import { describe, it, expect } from 'vitest';
import {
  evaluateAutomationMonitoring,
  scanForRawPii,
  hasCriticalAlert,
  ALERT_RULES,
  RULE_SEVERITY,
  type AutomationEvent,
  type MonitorConfig,
  type AlertRule,
} from './automationMonitoring.js';

const WORKSPACE = 'budget_wheels_demo';

const baseConfig: MonitorConfig = { expectedWorkspaceId: WORKSPACE };

/** A clean, mock-safe dry-run event that should trip NO rule. */
function safeEvent(overrides: Partial<AutomationEvent> = {}): AutomationEvent {
  return {
    id: 'evt-safe',
    workspaceId: WORKSPACE,
    action: 'email',
    mode: 'dry_run',
    sent: false,
    dispatched: false,
    liveRequested: false,
    approval: 'approved',
    connector: { name: 'mock-email', available: true },
    killSwitchActive: false,
    outcome: 'ok',
    target: 'lead@buyer.example',
    summary: 'dry-run email plan for prospect-1',
    ...overrides,
  };
}

/** Collect the rules present in a report's alerts. */
function rulesIn(events: AutomationEvent[], config = baseConfig): AlertRule[] {
  return evaluateAutomationMonitoring(events, config).alerts.map((a) => a.rule);
}

describe('evaluateAutomationMonitoring: clean baseline', () => {
  it('produces no alerts for a fleet of safe dry-run events', () => {
    const report = evaluateAutomationMonitoring(
      [safeEvent({ id: 'a' }), safeEvent({ id: 'b' }), safeEvent({ id: 'c' })],
      baseConfig,
    );
    expect(report.alerts).toEqual([]);
    expect(report.status).toBe('ok');
    expect(report.summary.totalEvents).toBe(3);
    expect(report.summary.alertCount).toBe(0);
    expect(hasCriticalAlert(report)).toBe(false);
  });

  it('embeds a no-egress / no-external-provider attestation', () => {
    const report = evaluateAutomationMonitoring([safeEvent()], baseConfig);
    expect(report.attestation.noLiveEgress).toBe(true);
    expect(report.attestation.noExternalProvider).toBe(true);
    expect(report.attestation.mode).toBe('MOCK_SANDBOX');
  });

  it('reports every rule in the per-rule summary, zeroed when clean', () => {
    const report = evaluateAutomationMonitoring([safeEvent()], baseConfig);
    for (const rule of ALERT_RULES) {
      expect(report.summary.byRule[rule]).toBe(0);
    }
  });

  it('is pure / deterministic across repeated runs', () => {
    const events = [safeEvent({ id: 'x' }), safeEvent({ id: 'y', sent: true })];
    const a = evaluateAutomationMonitoring(events, baseConfig);
    const b = evaluateAutomationMonitoring(events, baseConfig);
    expect(a).toEqual(b);
  });
});

describe('rule: unexpected_live_attempt', () => {
  it('fires when an action reports sent:true', () => {
    expect(rulesIn([safeEvent({ sent: true })])).toContain('unexpected_live_attempt');
  });

  it('fires when mode is not dry_run', () => {
    expect(rulesIn([safeEvent({ mode: 'live', sent: false })])).toContain(
      'unexpected_live_attempt',
    );
  });

  it('is critical severity', () => {
    expect(RULE_SEVERITY.unexpected_live_attempt).toBe('critical');
    const report = evaluateAutomationMonitoring([safeEvent({ sent: true })], baseConfig);
    expect(report.status).toBe('critical');
  });
});

describe('rule: approval_bypass', () => {
  it('fires on an explicit "bypassed" approval state', () => {
    expect(rulesIn([safeEvent({ approval: 'bypassed' })])).toContain('approval_bypass');
  });

  it('fires when a dispatched action was not approved', () => {
    expect(
      rulesIn([safeEvent({ dispatched: true, approval: 'pending', sent: false, mode: 'dry_run' })]),
    ).toContain('approval_bypass');
  });

  it('does not fire when an approved action merely plans (no dispatch)', () => {
    expect(rulesIn([safeEvent({ approval: 'approved', dispatched: false })])).not.toContain(
      'approval_bypass',
    );
  });
});

describe('rule: raw_pii', () => {
  it('allows synthetic-safe email/phone (.example, 555-01xx)', () => {
    expect(
      scanForRawPii(safeEvent({ target: 'lead@buyer.example', summary: 'call +1-555-0142' })),
    ).toEqual([]);
  });

  it('flags a raw email outside the safe TLDs', () => {
    // Invented negative-test value: a non-.example domain must be flagged.
    const kinds = scanForRawPii(safeEvent({ target: 'prospect@gmail.com' }));
    expect(kinds).toContain('email');
  });

  it('flags a raw phone outside the 555-01xx sandbox range', () => {
    // Invented negative-test value (fictional 555-7xxx, not the sandbox range).
    const kinds = scanForRawPii(safeEvent({ summary: 'reach at +1-206-555-7890' }));
    expect(kinds).toContain('phone');
  });

  it('scans nested payload content', () => {
    const kinds = scanForRawPii(
      safeEvent({ target: undefined, summary: undefined, payload: { note: 'x@personal.org' } }),
    );
    expect(kinds).toContain('email');
  });

  it('never returns the raw value, only the kind', () => {
    const kinds = scanForRawPii(safeEvent({ target: 'prospect@gmail.com' }));
    expect(kinds).toEqual(['email']);
  });

  it('emits a raw_pii alert that carries no raw value in its message/detail', () => {
    const report = evaluateAutomationMonitoring(
      [safeEvent({ target: 'prospect@gmail.com' })],
      baseConfig,
    );
    const alert = report.alerts.find((a) => a.rule === 'raw_pii');
    expect(alert).toBeDefined();
    expect(JSON.stringify(alert)).not.toContain('prospect@gmail.com');
  });
});

describe('rule: connector_unavailable', () => {
  it('fires when a connector reports unavailable', () => {
    expect(rulesIn([safeEvent({ connector: { name: 'mock-crm', available: false } })])).toContain(
      'connector_unavailable',
    );
  });

  it('does not fire for an available connector', () => {
    expect(
      rulesIn([safeEvent({ connector: { name: 'mock-crm', available: true } })]),
    ).not.toContain('connector_unavailable');
  });
});

describe('rule: high_failure_rate', () => {
  it('fires when failures meet/exceed the threshold over enough samples', () => {
    const events = [
      safeEvent({ id: 'f1', outcome: 'failed' }),
      safeEvent({ id: 'f2', outcome: 'failed' }),
      safeEvent({ id: 'ok1', outcome: 'ok' }),
    ];
    const report = evaluateAutomationMonitoring(events, baseConfig);
    const alert = report.alerts.find((a) => a.rule === 'high_failure_rate');
    expect(alert).toBeDefined();
    expect(alert?.eventRefs).toEqual(['f1', 'f2']);
    expect(alert?.detail?.failed).toBe(2);
    expect(alert?.detail?.graded).toBe(3);
  });

  it('does not fire below the minimum sample size', () => {
    const events = [safeEvent({ id: 'f1', outcome: 'failed' })];
    expect(rulesIn(events)).not.toContain('high_failure_rate');
  });

  it('does not fire below the configured threshold', () => {
    const events = [
      safeEvent({ id: 'f1', outcome: 'failed' }),
      safeEvent({ id: 'ok1', outcome: 'ok' }),
      safeEvent({ id: 'ok2', outcome: 'ok' }),
      safeEvent({ id: 'ok3', outcome: 'ok' }),
    ];
    expect(
      rulesIn(events, { expectedWorkspaceId: WORKSPACE, failureRateThreshold: 0.5 }),
    ).not.toContain('high_failure_rate');
  });

  it('ignores skipped/ungraded outcomes in the rate', () => {
    const events = [
      safeEvent({ id: 's1', outcome: 'skipped' }),
      safeEvent({ id: 's2', outcome: 'skipped' }),
      safeEvent({ id: 'f1', outcome: 'failed' }),
    ];
    // Only 1 graded attempt → below default min samples → no alert.
    expect(rulesIn(events)).not.toContain('high_failure_rate');
  });
});

describe('rule: kill_switch_active', () => {
  it('fires when the kill switch is engaged', () => {
    expect(rulesIn([safeEvent({ killSwitchActive: true })])).toContain('kill_switch_active');
  });

  it('flags an action in flight while halted', () => {
    const report = evaluateAutomationMonitoring(
      [safeEvent({ killSwitchActive: true, dispatched: true })],
      baseConfig,
    );
    const alert = report.alerts.find((a) => a.rule === 'kill_switch_active');
    expect(alert?.detail?.attemptedWhileHalted).toBe(true);
  });
});

describe('rule: workspace_mismatch', () => {
  it('fires when an event escapes the expected workspace', () => {
    expect(rulesIn([safeEvent({ workspaceId: 'some_other_tenant' })])).toContain(
      'workspace_mismatch',
    );
  });

  it('does not fire for the expected workspace', () => {
    expect(rulesIn([safeEvent({ workspaceId: WORKSPACE })])).not.toContain('workspace_mismatch');
  });
});

describe('rule: live_without_release_gate', () => {
  it('fires when live is requested with no open gate', () => {
    expect(rulesIn([safeEvent({ liveRequested: true, releaseGateOpen: false })])).toContain(
      'live_without_release_gate',
    );
  });

  it('fires when live is requested and the gate field is absent (fail closed)', () => {
    expect(rulesIn([safeEvent({ liveRequested: true, releaseGateOpen: undefined })])).toContain(
      'live_without_release_gate',
    );
  });

  it('does not fire when live is not requested', () => {
    expect(rulesIn([safeEvent({ liveRequested: false })])).not.toContain(
      'live_without_release_gate',
    );
  });
});

describe('fail-closed + multi-rule events', () => {
  it('a maximally bad event trips multiple critical rules at once', () => {
    const bad = safeEvent({
      id: 'bad',
      workspaceId: 'rogue_tenant',
      mode: 'live',
      sent: true,
      dispatched: true,
      liveRequested: true,
      releaseGateOpen: false,
      approval: 'bypassed',
      killSwitchActive: true,
      connector: { name: 'mock-email', available: false },
      target: 'victim@gmail.com',
    });
    const report = evaluateAutomationMonitoring([bad], baseConfig);
    const rules = new Set(report.alerts.map((a) => a.rule));
    expect(rules.has('unexpected_live_attempt')).toBe(true);
    expect(rules.has('approval_bypass')).toBe(true);
    expect(rules.has('raw_pii')).toBe(true);
    expect(rules.has('connector_unavailable')).toBe(true);
    expect(rules.has('kill_switch_active')).toBe(true);
    expect(rules.has('workspace_mismatch')).toBe(true);
    expect(rules.has('live_without_release_gate')).toBe(true);
    expect(report.status).toBe('critical');
    expect(hasCriticalAlert(report)).toBe(true);
  });

  it('handles an empty event list as ok', () => {
    const report = evaluateAutomationMonitoring([], baseConfig);
    expect(report.status).toBe('ok');
    expect(report.summary.totalEvents).toBe(0);
  });

  it('uses positional refs when events lack ids', () => {
    const report = evaluateAutomationMonitoring(
      [safeEvent({ id: undefined, sent: true })],
      baseConfig,
    );
    const alert = report.alerts.find((a) => a.rule === 'unexpected_live_attempt');
    expect(alert?.eventRefs).toEqual(['#0']);
  });
});
