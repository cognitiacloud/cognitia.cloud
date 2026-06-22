/**
 * Mock-safe AUTOMATION MONITORING READINESS for the Sales Closer lane.
 *
 * STATUS: MOCK / SANDBOX. This module is a pure, deterministic *detector*. It
 * ingests synthetic automation events (the kind a closer run, channel layer,
 * or operator console would emit) and returns alerts when a safety invariant
 * is violated. It does NOT monitor anything live, NOT call any external
 * monitoring/observability provider, NOT touch the network, secrets, or any
 * vendor SDK, and issues NO production-readiness claim.
 *
 * It exists so that, the moment any code path *attempts* to misbehave, a
 * tripwire fires loudly in tests and in an operator console — long before any
 * live lane could be enabled. The detector itself is fail-closed: absent or
 * ambiguous state is treated as the unsafe interpretation.
 *
 * The eight rules it detects (see {@link AlertRule}):
 *   1. unexpected_live_attempt        — an action ran live / claims it sent
 *   2. approval_bypass                — an action proceeded without approval
 *   3. raw_pii                        — raw email/phone leaked into content
 *   4. connector_unavailable          — a connector reported itself down
 *   5. high_failure_rate              — outcomes failed above a threshold
 *   6. kill_switch_active             — the global kill switch is engaged
 *   7. workspace_mismatch             — an event escaped its tenant scope
 *   8. live_without_release_gate      — live requested with no open gate
 *
 * Self-contained by design: it imports NOTHING (no sibling lanes, no network,
 * no vendor). Callers adapt their own run/channel records into
 * {@link AutomationEvent}. All functions are pure: identical input always
 * yields identical output, with no clock, randomness, or IO.
 */

/* ------------------------------------------------------------------ vocabulary */

/** The eight monitoring rules, in fixed display order. */
export const ALERT_RULES = [
  'unexpected_live_attempt',
  'approval_bypass',
  'raw_pii',
  'connector_unavailable',
  'high_failure_rate',
  'kill_switch_active',
  'workspace_mismatch',
  'live_without_release_gate',
] as const;

export type AlertRule = (typeof ALERT_RULES)[number];

/** Alert severity, from most to least urgent. */
export type AlertSeverity = 'critical' | 'high' | 'warning';

/** Overall monitoring status; the highest severity present, or 'ok'. */
export type MonitoringStatus = 'critical' | 'high' | 'warning' | 'ok';

/** Fixed severity per rule. */
export const RULE_SEVERITY: Readonly<Record<AlertRule, AlertSeverity>> = {
  unexpected_live_attempt: 'critical',
  approval_bypass: 'critical',
  raw_pii: 'critical',
  kill_switch_active: 'critical',
  live_without_release_gate: 'critical',
  connector_unavailable: 'high',
  workspace_mismatch: 'high',
  high_failure_rate: 'warning',
};

/** Outcome of a single (mock) automation attempt. */
export type AttemptOutcome = 'ok' | 'failed' | 'skipped';

/** Human-approval state attached to an action. */
export type ApprovalState = 'approved' | 'rejected' | 'pending' | 'bypassed' | 'none';

/**
 * A single synthetic automation event — the detector's input unit. Every field
 * beyond `workspaceId` is optional so partial/forged records still evaluate
 * (and fail closed). Identifiers only; raw PII must NOT appear here, and the
 * detector scans the content fields precisely to catch it when it does.
 */
export interface AutomationEvent {
  /** Opaque, non-PII event id. Falls back to a positional ref when absent. */
  id?: string;
  /** The workspace/tenant this event belongs to. */
  workspaceId: string;
  /** The action/channel kind (e.g. 'email', 'crm_writeback'). Opaque label. */
  action?: string;
  /**
   * Execution mode the action claims. `'dry_run'` is the only safe mode; any
   * other value (or `sent: true`) is treated as a live attempt.
   */
  mode?: 'dry_run' | 'live' | (string & {});
  /** Whether the action reports it actually sent. Must be false/absent. */
  sent?: boolean;
  /** Whether the action was released/dispatched beyond mere planning. */
  dispatched?: boolean;
  /** The caller's request to go live. */
  liveRequested?: boolean;
  /** Whether a release gate was open/satisfied for a live request. */
  releaseGateOpen?: boolean;
  /** Human-approval state for this action. */
  approval?: ApprovalState;
  /** Connector availability snapshot observed at event time. */
  connector?: { name: string; available: boolean };
  /** Whether the global kill switch was engaged at event time. */
  killSwitchActive?: boolean;
  /** Outcome of the attempt, used for the failure-rate rule. */
  outcome?: AttemptOutcome;
  /**
   * Preview/content fields that COULD accidentally carry raw PII. These — and
   * only these — are scanned by the raw_pii rule (ids/refs are never scanned).
   */
  target?: string;
  summary?: string;
  payload?: Record<string, unknown>;
}

/** Tuning for the detector. All thresholds fail closed at sensible defaults. */
export interface MonitorConfig {
  /** The workspace events are expected to belong to. Others are a mismatch. */
  expectedWorkspaceId: string;
  /** Failure-rate alert threshold in [0, 1]. Default 0.5. */
  failureRateThreshold?: number;
  /** Minimum graded attempts before the failure-rate rule can fire. Default 3. */
  failureRateMinSamples?: number;
}

/** A single emitted alert. Carries opaque refs + PII-free detail only. */
export interface MonitoringAlert {
  rule: AlertRule;
  severity: AlertSeverity;
  /** Human-readable, PII-free description. */
  message: string;
  /** Opaque event refs (ids or `#index`) that triggered the alert. */
  eventRefs: string[];
  /** Structured, PII-free supporting detail. */
  detail?: Record<string, string | number | boolean>;
}

/** No-live-monitoring-provider / no-egress attestation on every report. */
export interface MonitoringAttestation {
  /** Always true — the detector performs no network egress. */
  noLiveEgress: true;
  /** Always true — no external monitoring/observability provider is used. */
  noExternalProvider: true;
  /** Fixed mode label. */
  mode: 'MOCK_SANDBOX';
  /** Human-readable statement for an operator console + audit. */
  statement: string;
}

export interface MonitoringReport {
  /** Highest severity present across alerts, or 'ok'. */
  status: MonitoringStatus;
  /** Alerts in deterministic order (per-event in input order, then aggregate). */
  alerts: MonitoringAlert[];
  summary: {
    totalEvents: number;
    alertCount: number;
    /** Count of alerts per rule (every rule key present, zero when none). */
    byRule: Record<AlertRule, number>;
  };
  attestation: MonitoringAttestation;
}

const ATTESTATION: MonitoringAttestation = {
  noLiveEgress: true,
  noExternalProvider: true,
  mode: 'MOCK_SANDBOX',
  statement:
    'MOCK/SANDBOX: monitoring runs in-memory over synthetic events. No live ' +
    'egress, no external monitoring/observability provider, no vendor SDK.',
};

/* ------------------------------------------------------------------- pii scan */

/**
 * Email shape. The synthetic-safe TLDs `.example` / `.test` / `.invalid` are
 * permitted; anything else is treated as raw PII.
 */
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const SAFE_EMAIL_RE = /\.(example|test|invalid)$/i;

/**
 * Phone-ish run of 10+ digits (with common separators). The reserved sandbox
 * range `555-01xx` is permitted; anything else of phone length is raw PII.
 */
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g;
const SAFE_PHONE_RE = /555[\s.-]?01\d\d/;

/** A redacted PII finding — records the KIND only, never the value. */
export type PiiKind = 'email' | 'phone';

/**
 * Scan only the content fields of an event for raw PII, returning the distinct
 * kinds found. Allows the repo's synthetic-safe ranges (`*.example` etc.,
 * `555-01xx`). Never returns the matched value, so the detector itself cannot
 * leak PII into an alert.
 */
export function scanForRawPii(event: AutomationEvent): PiiKind[] {
  const content = {
    target: event.target,
    summary: event.summary,
    payload: event.payload,
  };
  const text = JSON.stringify(content) ?? '';
  const kinds = new Set<PiiKind>();

  for (const match of text.match(EMAIL_RE) ?? []) {
    const domain = match.slice(match.lastIndexOf('@') + 1);
    if (!SAFE_EMAIL_RE.test(domain)) kinds.add('email');
  }

  for (const match of text.match(PHONE_RE) ?? []) {
    const digits = match.replace(/\D/g, '');
    // Phone numbers are 10–15 digits; longer runs are opaque ids, not phones.
    if (digits.length >= 10 && digits.length <= 15 && !SAFE_PHONE_RE.test(match)) {
      kinds.add('phone');
    }
  }

  return [...kinds];
}

/* --------------------------------------------------------------------- detect */

/** True if an event indicates the action proceeded beyond a dry-run plan. */
function actionProceeded(e: AutomationEvent): boolean {
  return e.sent === true || e.dispatched === true || e.mode === 'live';
}

function refOf(event: AutomationEvent, index: number): string {
  return event.id ?? `#${index}`;
}

/**
 * Evaluate the eight monitoring rules over a list of synthetic automation
 * events. Pure and deterministic. Returns a report with an attestation, alerts
 * in stable order, and a per-rule summary. Never throws on malformed input —
 * it fails closed into alerts instead.
 */
export function evaluateAutomationMonitoring(
  events: readonly AutomationEvent[],
  config: MonitorConfig,
): MonitoringReport {
  const threshold = clamp01(config.failureRateThreshold ?? 0.5);
  const minSamples = Math.max(1, Math.floor(config.failureRateMinSamples ?? 3));

  const alerts: MonitoringAlert[] = [];
  const push = (
    rule: AlertRule,
    message: string,
    eventRefs: string[],
    detail?: MonitoringAlert['detail'],
  ): void => {
    alerts.push({ rule, severity: RULE_SEVERITY[rule], message, eventRefs, detail });
  };

  // Failure-rate accumulators (aggregate rule, emitted last).
  let graded = 0;
  let failed = 0;
  const failedRefs: string[] = [];

  events.forEach((event, index) => {
    const ref = refOf(event, index);
    const proceeded = actionProceeded(event);

    // 1. unexpected_live_attempt — non-dry_run mode or a reported send.
    if (event.sent === true || (event.mode !== undefined && event.mode !== 'dry_run')) {
      push(
        'unexpected_live_attempt',
        `action "${event.action ?? 'unknown'}" attempted a live send (mock-safe layers must stay dry_run, sent:false)`,
        [ref],
        {
          action: event.action ?? 'unknown',
          mode: String(event.mode ?? 'undefined'),
          sent: event.sent === true,
        },
      );
    }

    // 2. approval_bypass — explicit bypass, or a proceeding action not approved.
    if (event.approval === 'bypassed') {
      push(
        'approval_bypass',
        `action "${event.action ?? 'unknown'}" reported approval state "bypassed"`,
        [ref],
        {
          action: event.action ?? 'unknown',
          approval: 'bypassed',
        },
      );
    } else if (proceeded && event.approval !== 'approved') {
      push(
        'approval_bypass',
        `action "${event.action ?? 'unknown'}" proceeded with approval "${event.approval ?? 'none'}" (expected "approved")`,
        [ref],
        {
          action: event.action ?? 'unknown',
          approval: String(event.approval ?? 'none'),
        },
      );
    }

    // 3. raw_pii — raw email/phone in content fields.
    const piiKinds = scanForRawPii(event);
    if (piiKinds.length > 0) {
      push(
        'raw_pii',
        `raw PII (${piiKinds.join(', ')}) detected in content of action "${event.action ?? 'unknown'}"`,
        [ref],
        {
          action: event.action ?? 'unknown',
          kinds: piiKinds.join(','),
        },
      );
    }

    // 4. connector_unavailable — a connector reported itself down.
    if (event.connector && event.connector.available === false) {
      push(
        'connector_unavailable',
        `connector "${event.connector.name}" reported unavailable`,
        [ref],
        {
          connector: event.connector.name,
          proceeded,
        },
      );
    }

    // 6. kill_switch_active — the global kill switch is engaged.
    if (event.killSwitchActive === true) {
      const attemptedWhileHalted = proceeded || event.action !== undefined;
      push(
        'kill_switch_active',
        attemptedWhileHalted
          ? `kill switch active while action "${event.action ?? 'unknown'}" was in flight (operations must be halted)`
          : 'kill switch active (operations must be halted)',
        [ref],
        {
          attemptedWhileHalted,
        },
      );
    }

    // 7. workspace_mismatch — event escaped the expected tenant scope.
    if (event.workspaceId !== config.expectedWorkspaceId) {
      push(
        'workspace_mismatch',
        `event workspace "${event.workspaceId}" does not match expected "${config.expectedWorkspaceId}"`,
        [ref],
        {
          eventWorkspace: event.workspaceId,
          expectedWorkspace: config.expectedWorkspaceId,
        },
      );
    }

    // 8. live_without_release_gate — live requested with no open gate.
    if (event.liveRequested === true && event.releaseGateOpen !== true) {
      push(
        'live_without_release_gate',
        `live action "${event.action ?? 'unknown'}" requested without an open release gate (fail closed)`,
        [ref],
        {
          action: event.action ?? 'unknown',
          // Narrowed to non-true within this branch (false | undefined).
          releaseGateOpen: false,
        },
      );
    }

    // Failure-rate accumulation (graded attempts only).
    if (event.outcome === 'ok' || event.outcome === 'failed') {
      graded += 1;
      if (event.outcome === 'failed') {
        failed += 1;
        failedRefs.push(ref);
      }
    }
  });

  // 5. high_failure_rate — aggregate, emitted after per-event alerts.
  if (graded >= minSamples) {
    const rate = failed / graded;
    if (rate >= threshold) {
      push(
        'high_failure_rate',
        `failure rate ${formatRate(rate)} over ${graded} attempts meets/exceeds threshold ${formatRate(threshold)}`,
        failedRefs,
        {
          failed,
          graded,
          rate: Number(rate.toFixed(4)),
          threshold,
        },
      );
    }
  }

  return {
    status: rollupStatus(alerts),
    alerts,
    summary: {
      totalEvents: events.length,
      alertCount: alerts.length,
      byRule: countByRule(alerts),
    },
    attestation: ATTESTATION,
  };
}

/** True if the report contains at least one critical alert. */
export function hasCriticalAlert(report: MonitoringReport): boolean {
  return report.alerts.some((a) => a.severity === 'critical');
}

/* ---------------------------------------------------------------------- utils */

function rollupStatus(alerts: readonly MonitoringAlert[]): MonitoringStatus {
  if (alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (alerts.some((a) => a.severity === 'high')) return 'high';
  if (alerts.some((a) => a.severity === 'warning')) return 'warning';
  return 'ok';
}

function countByRule(alerts: readonly MonitoringAlert[]): Record<AlertRule, number> {
  const byRule = Object.fromEntries(ALERT_RULES.map((r) => [r, 0])) as Record<AlertRule, number>;
  for (const alert of alerts) byRule[alert.rule] += 1;
  return byRule;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function formatRate(n: number): string {
  return `${Math.round(clamp01(n) * 100)}%`;
}
