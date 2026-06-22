/**
 * Monitoring rule definitions (mock-safe, dependency-free).
 *
 * Rules are evaluated against the audit event stream. They are declarative and
 * side-effect free here; an alerting sink (paging, dashboards) consumes the
 * {@link MonitoringAlert}s this module produces. Nothing in this module performs
 * network I/O — it is a pure rule engine over events.
 */

import type { AuditEvent, AuditEventName } from './audit.ts';

export type Severity = 'info' | 'warning' | 'critical';

export interface MonitoringRule {
  readonly id: string;
  readonly description: string;
  readonly severity: Severity;
  /** Event names this rule watches. */
  readonly match: readonly AuditEventName[];
  /**
   * Fire if at least `threshold` matching events occur inside `windowMs`.
   * A threshold of 1 means "any single occurrence pages".
   */
  readonly threshold: number;
  readonly windowMs: number;
}

export const MONITORING_RULES: readonly MonitoringRule[] = [
  {
    id: 'live-action-attempt',
    description: 'Any attempt to run a live action while dark must page immediately.',
    severity: 'critical',
    match: ['action.live.blocked.v1'],
    threshold: 1,
    windowMs: 60_000,
  },
  {
    id: 'release-gate-override',
    description: 'A human overrode a release gate — record and notify.',
    severity: 'warning',
    match: ['release.gate.overridden.v1'],
    threshold: 1,
    windowMs: 60_000,
  },
  {
    id: 'authz-denial-spike',
    description: 'Spike in access denials may indicate a misconfig or probing.',
    severity: 'warning',
    match: ['authz.access.denied.v1'],
    threshold: 20,
    windowMs: 5 * 60_000,
  },
  {
    id: 'connector-config-change',
    description: 'Connector configuration changed — confirm it stayed in dark mode.',
    severity: 'warning',
    match: ['connector.config.changed.v1'],
    threshold: 1,
    windowMs: 60_000,
  },
  {
    id: 'incident-declared',
    description: 'An incident was declared — open the incident bridge.',
    severity: 'critical',
    match: ['incident.declared.v1'],
    threshold: 1,
    windowMs: 60_000,
  },
];

export interface MonitoringAlert {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly count: number;
  readonly firstAt: string;
  readonly lastAt: string;
}

/**
 * Evaluate one rule against a batch of events. Returns an alert if the count of
 * matching events within any sliding window of `windowMs` meets the threshold.
 */
export function evaluateRule(
  rule: MonitoringRule,
  events: readonly AuditEvent[],
): MonitoringAlert | null {
  const match = new Set<string>(rule.match);
  const ts = events
    .filter((e) => match.has(e.event_name))
    .map((e) => Date.parse(e.occurred_at))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (ts.length < rule.threshold) return null;

  // Sliding window: any [i, i+threshold-1] span within windowMs trips the rule.
  for (let i = 0; i + rule.threshold - 1 < ts.length; i++) {
    const span = ts[i + rule.threshold - 1]! - ts[i]!;
    if (span <= rule.windowMs) {
      return {
        ruleId: rule.id,
        severity: rule.severity,
        count: ts.length,
        firstAt: new Date(ts[i]!).toISOString(),
        lastAt: new Date(ts[ts.length - 1]!).toISOString(),
      };
    }
  }
  return null;
}

/** Evaluate the whole rule set, returning every alert that fired. */
export function evaluateAll(events: readonly AuditEvent[]): readonly MonitoringAlert[] {
  return MONITORING_RULES.map((r) => evaluateRule(r, events)).filter(
    (a): a is MonitoringAlert => a !== null,
  );
}
