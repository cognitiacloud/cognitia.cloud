'use client';

/**
 * UI-1 — Approval console (V1: CRM write-back only; NO email affordances).
 *
 * Auth: the operator pastes a signed session token (issued per
 * docs/launch/operator-handoff.md step 7). The token goes into the
 * `Authorization: Bearer` header; the API derives tenant + role from it —
 * the browser never supplies a tenant id. 401/403/409 are surfaced explicitly.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiClient,
  ApiError,
  APPROVE_REASON_CODES,
  REJECT_REASON_CODES,
  type AgentActionView,
  type DecisionLabelView,
  type AuditTrailView,
  type DecisionRationaleView,
  type ExecutionPreviewView,
  type GovernanceMatrixView,
  type OpportunityView,
  type RunPlanView,
  type RunDetailView,
  type ScorecardReportView,
  type SyncRunView,
  type IntegrationStatusView,
  type PreflightReportView,
  type ReadinessView,
  type TrustMetricsView,
} from '../../lib/apiClient';
import { toApprovalRow } from '../../lib/approvalQueue';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Notice = { kind: 'error' | 'info'; text: string } | null;

/**
 * In-progress decision: which action(s) are being approved/rejected and why.
 * A structured reason is mandatory — the API returns 400 without one. One or
 * many ids share the same reason panel; a single id uses the per-action
 * endpoint, multiple ids use the batch endpoint (UX-2).
 */
type PendingDecision = {
  ids: string[];
  kind: 'approve' | 'reject' | 'rollback';
  reasonCode: string;
  note: string;
};

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401)
      return 'Session invalid or expired (401) — paste a valid operator session token.';
    if (err.status === 403)
      return 'Insufficient permission (403) — your role cannot approve/execute (viewer?).';
    if (err.status === 409)
      return 'Refused (409): the action is not approved yet — approve it before executing.';
    const detail =
      typeof err.payload === 'object' && err.payload !== null && 'error' in err.payload
        ? String((err.payload as { error: unknown }).error)
        : '';
    return `Request failed (${err.status})${detail ? `: ${detail}` : ''}`;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

const box: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 16,
};
const btn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
};
const btnPrimary: React.CSSProperties = {
  ...btn,
  background: '#111827',
  color: '#fff',
  border: '1px solid #111827',
};
const btnDisabled: React.CSSProperties = { ...btn, opacity: 0.4, cursor: 'not-allowed' };

export default function ApprovalsPage() {
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [actions, setActions] = useState<AgentActionView[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<PendingDecision | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<DecisionLabelView[] | null>(null);
  const [metrics, setMetrics] = useState<TrustMetricsView | null>(null);
  // GOV-1: per-action write preview, expanded inline under the row.
  const [preview, setPreview] = useState<{ id: string; data: ExecutionPreviewView } | null>(null);
  // WHY-1: decision rationale (score + grounding facts + freshness), per row.
  const [rationale, setRationale] = useState<{ id: string; data: DecisionRationaleView } | null>(
    null,
  );
  // SIM-1: zero-write preflight simulation report.
  const [preflight, setPreflight] = useState<PreflightReportView | null>(null);
  // ENF-1: kill-switch state, governance matrix, audit trail panels.
  const [integration, setIntegration] = useState<IntegrationStatusView | null>(null);
  // RDY-1: go-live readiness report.
  const [readiness, setReadiness] = useState<ReadinessView | null>(null);
  const [governance, setGovernance] = useState<GovernanceMatrixView | null>(null);
  // LEARN-1: per-segment governance scorecards panel.
  const [scorecards, setScorecards] = useState<ScorecardReportView | null>(null);
  // RUN-1: run/plan rollups panel (the operator's unit of work).
  const [runPlans, setRunPlans] = useState<RunPlanView[] | null>(null);
  // RUN-2: expanded run detail/timeline, keyed by run_id.
  const [runDetail, setRunDetail] = useState<RunDetailView | null>(null);
  // EVID-1: integration sync history + opportunities visibility panels.
  const [syncHistory, setSyncHistory] = useState<SyncRunView[] | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityView[] | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailView | null>(null);

  // Session token survives a reload within the tab only (sessionStorage, not localStorage).
  useEffect(() => {
    const saved = sessionStorage.getItem('cognitia.session');
    if (saved) setToken(saved);
    const savedUrl = sessionStorage.getItem('cognitia.apiUrl');
    if (savedUrl) setBaseUrl(savedUrl);
  }, []);

  const client = useMemo(() => {
    if (!token) return null;
    const authedFetch: typeof fetch = (url, init) =>
      fetch(url, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), authorization: `Bearer ${token}` },
      });
    return new ApiClient({ baseUrl, tenantId: '', fetch: authedFetch });
  }, [token, baseUrl]);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      setBusy(true);
      const res = await client.listActions(); // all statuses: proposed + approved + rejected
      setActions(res.actions);
      setNotice(null);
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
    // Trust strip + kill-switch chip are best-effort: never block the queue.
    try {
      setMetrics(await client.trustMetrics());
    } catch {
      setMetrics(null);
    }
    try {
      setIntegration(await client.integrationStatus());
    } catch {
      setIntegration(null);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, okText: string) => {
      try {
        setBusy(true);
        await fn();
        setNotice({ kind: 'info', text: okText });
      } catch (err) {
        setNotice({ kind: 'error', text: explainError(err) });
      } finally {
        setBusy(false);
        await refresh();
      }
    },
    [refresh],
  );

  const confirmDecision = useCallback(async () => {
    if (!decision || !client) return;
    const d = decision;
    const reason = {
      reason_code: d.reasonCode,
      note: d.note.trim() ? d.note.trim() : undefined,
    };
    setDecision(null);
    if (d.ids.length === 1) {
      const id = d.ids[0]!;
      await act(
        () =>
          d.kind === 'approve'
            ? client.approve(id, reason)
            : d.kind === 'rollback'
              ? client.rollback(id, reason)
              : client.reject(id, reason),
        d.kind === 'approve'
          ? 'Action approved.'
          : d.kind === 'rollback'
            ? 'Write rolled back — the CRM object was archived.'
            : 'Action rejected.',
      );
      return;
    }
    // Batch: surface the per-id summary, and clear the selection afterwards.
    try {
      setBusy(true);
      const res =
        d.kind === 'approve'
          ? await client.batchApprove(d.ids, reason)
          : await client.batchReject(d.ids, reason);
      const verb = d.kind === 'approve' ? 'Approved' : 'Rejected';
      const failed = res.requested - res.succeeded;
      setNotice({
        kind: failed === 0 ? 'info' : 'error',
        text:
          failed === 0
            ? `${verb} ${res.succeeded}/${res.requested}.`
            : `${verb} ${res.succeeded}/${res.requested} — ${failed} failed (see status codes).`,
      });
      setSelected(new Set());
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [decision, client, act, refresh]);

  const loadHistory = useCallback(async () => {
    if (!client) return;
    try {
      setBusy(true);
      const res = await client.listAllDecisions();
      // Most recent first.
      setHistory([...res.decisions].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
      setNotice(null);
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client]);

  const togglePreview = useCallback(
    async (id: string) => {
      if (!client) return;
      if (preview?.id === id) {
        setPreview(null); // collapse
        return;
      }
      try {
        setBusy(true);
        setPreview({ id, data: await client.previewAction(id) });
      } catch (err) {
        setNotice({ kind: 'error', text: explainError(err) });
      } finally {
        setBusy(false);
      }
    },
    [client, preview],
  );

  const toggleRationale = useCallback(
    async (id: string) => {
      if (!client) return;
      if (rationale?.id === id) {
        setRationale(null); // collapse
        return;
      }
      try {
        setBusy(true);
        setRationale({ id, data: await client.actionRationale(id) });
      } catch (err) {
        setNotice({ kind: 'error', text: explainError(err) });
      } finally {
        setBusy(false);
      }
    },
    [client, rationale],
  );

  const runPreflight = useCallback(async () => {
    if (!client) return;
    if (preflight) {
      setPreflight(null); // collapse
      return;
    }
    try {
      setBusy(true);
      setPreflight(await client.preflight({ objective: 'build outbound pipeline' }));
      setNotice(null);
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client, preflight]);

  const checkReadiness = useCallback(async () => {
    if (!client) return;
    if (readiness) {
      setReadiness(null); // collapse
      return;
    }
    try {
      setBusy(true);
      setReadiness(await client.integrationReadiness());
      setNotice(null);
    } catch (err) {
      // 409 (not ready) / 503 (unconfigured) carry the report as the payload —
      // a not-ready result is expected, not a failure.
      if (
        err instanceof ApiError &&
        err.payload &&
        typeof err.payload === 'object' &&
        'ready' in err.payload
      ) {
        setReadiness(err.payload as ReadinessView);
        setNotice(null);
      } else {
        setNotice({ kind: 'error', text: explainError(err) });
      }
    } finally {
      setBusy(false);
    }
  }, [client, readiness]);

  const exportTrustPacket = useCallback(async () => {
    if (!client) return;
    try {
      setBusy(true);
      const packet = await client.trustPacket();
      const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cognitia-trust-packet-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice({ kind: 'info', text: 'Trust packet exported (live-derived, eval gate re-run).' });
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client]);

  const exportRegression = useCallback(
    async (id: string) => {
      if (!client) return;
      try {
        setBusy(true);
        const { candidate } = await client.regressionCandidate(id);
        const blob = new Blob([JSON.stringify(candidate, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cognitia-regression-${id.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setNotice({
          kind: 'info',
          text: 'Regression candidate exported (anonymized). Adopt it into regressions-v1.json with the behavior fix.',
        });
      } catch (err) {
        setNotice({ kind: 'error', text: explainError(err) });
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  const toggleGovernance = useCallback(async () => {
    if (!client) return;
    if (governance) {
      setGovernance(null);
      return;
    }
    try {
      setBusy(true);
      setGovernance(await client.governance());
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client, governance]);

  const toggleScorecards = useCallback(async () => {
    if (!client) return;
    if (scorecards) {
      setScorecards(null);
      return;
    }
    try {
      setBusy(true);
      setScorecards(await client.scorecards());
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client, scorecards]);

  const toggleRunPlans = useCallback(async () => {
    if (!client) return;
    if (runPlans) {
      setRunPlans(null);
      setRunDetail(null);
      return;
    }
    try {
      setBusy(true);
      setRunPlans((await client.runPlans()).runs);
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client, runPlans]);

  // RUN-2: expand/collapse a single run's action timeline.
  const toggleRunDetail = useCallback(
    async (runId: string) => {
      if (!client) return;
      if (runDetail?.run.id === runId) {
        setRunDetail(null);
        return;
      }
      try {
        setBusy(true);
        setRunDetail(await client.runDetail(runId));
      } catch (err) {
        setNotice({ kind: 'error', text: explainError(err) });
      } finally {
        setBusy(false);
      }
    },
    [client, runDetail],
  );

  const toggleSyncHistory = useCallback(async () => {
    if (!client) return;
    if (syncHistory) {
      setSyncHistory(null);
      return;
    }
    try {
      setBusy(true);
      setSyncHistory((await client.syncHistory()).sync_runs);
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client, syncHistory]);

  const toggleOpportunities = useCallback(async () => {
    if (!client) return;
    if (opportunities) {
      setOpportunities(null);
      return;
    }
    try {
      setBusy(true);
      setOpportunities((await client.opportunities()).opportunities);
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client, opportunities]);

  const toggleAudit = useCallback(async () => {
    if (!client) return;
    if (auditTrail) {
      setAuditTrail(null);
      return;
    }
    try {
      setBusy(true);
      setAuditTrail(await client.auditTrail());
    } catch (err) {
      setNotice({ kind: 'error', text: explainError(err) });
    } finally {
      setBusy(false);
    }
  }, [client, auditTrail]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Only proposed actions can be approved/rejected (and thus batch-selected).
  const selectableProposed = useMemo(
    () => actions.filter((a) => a.approval_status === 'proposed'),
    [actions],
  );

  if (!token) {
    return (
      <main style={{ maxWidth: 560, margin: '80px auto', padding: 16 }}>
        <div style={box}>
          <h1 style={{ fontSize: 18, marginTop: 0 }}>Cognitia — Operator sign-in</h1>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            Paste your operator session token (issued by your admin per the operator handoff). The
            token determines your tenant and role — nothing else is trusted.
          </p>
          <input
            type="password"
            placeholder="session token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 8, boxSizing: 'border-box' }}
          />
          <input
            placeholder={`API URL (default ${DEFAULT_API})`}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
          />
          <button
            style={btnPrimary}
            onClick={() => {
              sessionStorage.setItem('cognitia.session', tokenInput);
              sessionStorage.setItem('cognitia.apiUrl', baseUrl);
              setToken(tokenInput);
            }}
            disabled={!tokenInput}
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: 16 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Approval queue — CRM actions</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={busy ? btnDisabled : btnPrimary}
            disabled={busy}
            onClick={() =>
              act(
                () => client!.runMira({ objective: 'build outbound pipeline' }),
                'Mira run completed — proposals refreshed.',
              )
            }
          >
            Run Mira
          </button>
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void runPreflight()}
          >
            {preflight ? 'Hide preflight' : 'Preflight (no writes)'}
          </button>
          <button style={busy ? btnDisabled : btn} disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => (history ? setHistory(null) : void loadHistory())}
          >
            {history ? 'Hide history' : 'Decision history'}
          </button>
          {/* TRUST-2: downloads the live-derived trust packet as JSON. */}
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void exportTrustPacket()}
          >
            Export trust packet
          </button>
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void toggleGovernance()}
          >
            {governance ? 'Hide governance' : 'Governance'}
          </button>
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void toggleScorecards()}
          >
            {scorecards ? 'Hide scorecards' : 'Scorecards'}
          </button>
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void toggleRunPlans()}
          >
            {runPlans ? 'Hide runs' : 'Runs'}
          </button>
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void toggleSyncHistory()}
          >
            {syncHistory ? 'Hide sync history' : 'Sync history'}
          </button>
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void toggleOpportunities()}
          >
            {opportunities ? 'Hide opportunities' : 'Opportunities'}
          </button>
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void toggleAudit()}
          >
            {auditTrail ? 'Hide audit' : 'Audit trail'}
          </button>
          {/* RDY-1: go-live readiness gate (portal properties + connection). */}
          <button
            style={busy ? btnDisabled : btn}
            disabled={busy}
            onClick={() => void checkReadiness()}
          >
            {readiness ? 'Hide readiness' : 'Check readiness'}
          </button>
          {/* ENF-1: enforced kill switch — pause is operator-grade, resume owner-only. */}
          {integration && integration.status !== 'not_connected' && (
            <button
              style={busy ? btnDisabled : btn}
              disabled={busy}
              onClick={() =>
                act(
                  () =>
                    integration.kill_switch.halted
                      ? client!.resumeIntegration()
                      : client!.pauseIntegration(),
                  integration.kill_switch.halted
                    ? 'Integration resumed — execution re-enabled.'
                    : 'EMERGENCY STOP — all execution and rollback halted for this tenant.',
                )
              }
            >
              {integration.kill_switch.halted ? 'Resume (owner)' : 'Pause integration'}
            </button>
          )}
          <button
            style={btn}
            onClick={() => {
              sessionStorage.removeItem('cognitia.session');
              setToken('');
              setActions([]);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {metrics && (
        <div
          style={{
            ...box,
            marginBottom: 12,
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            fontSize: 12,
            color: '#374151',
          }}
        >
          <span>
            <strong>
              {metrics.approval_rate === null ? '—' : `${Math.round(metrics.approval_rate * 100)}%`}
            </strong>{' '}
            approval rate
          </span>
          <span>
            <strong>{metrics.actions.approved + metrics.actions.rejected}</strong> decisions
          </span>
          <span>
            <strong>{metrics.actions.executed}</strong> executed
          </span>
          <span>
            <strong>
              {metrics.median_decision_seconds === null
                ? '—'
                : `${Math.round(metrics.median_decision_seconds)}s`}
            </strong>{' '}
            median decision time
          </span>
          <span>
            <strong>{metrics.duplicate_writes_prevented}</strong> duplicate writes prevented
          </span>
        </div>
      )}

      {integration?.kill_switch.halted && (
        <div
          role="alert"
          style={{
            ...box,
            marginBottom: 12,
            borderColor: '#fca5a5',
            background: '#fef2f2',
            fontSize: 13,
          }}
        >
          <strong>Execution halted.</strong> The {integration.system} connection is{' '}
          <strong>{integration.status}</strong>: all execute and rollback requests are refused (409)
          and audited until an owner resumes.
        </div>
      )}

      {readiness && (
        <div
          style={{
            ...box,
            marginBottom: 12,
            borderColor: readiness.ready ? '#a7f3d0' : '#fca5a5',
            background: readiness.ready ? '#ecfdf5' : '#fef2f2',
          }}
        >
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            Go-live readiness — <strong>{readiness.ready ? 'READY' : 'NOT READY'}</strong>
            {readiness.connection_status ? ` (connection: ${readiness.connection_status})` : ''}
          </h2>
          {readiness.reason && (
            <div style={{ fontSize: 13, color: '#374151' }}>{readiness.reason}</div>
          )}
          {readiness.checks && (
            <ul style={{ fontSize: 13, margin: '6px 0', paddingLeft: 18 }}>
              {readiness.checks.map((c) => (
                <li key={c.name} style={{ color: c.ok ? '#047857' : '#b91c1c' }}>
                  {c.ok ? '✓' : '✗'} {c.name}: {c.detail}
                </li>
              ))}
            </ul>
          )}
          {!readiness.ready && readiness.missing_properties && (
            <div style={{ fontSize: 12, color: '#b91c1c' }}>
              Create the missing custom properties in the HubSpot portal (Tasks & Notes), then
              re-check. See <code>docs/runbooks/hubspot-onboarding.md</code>.
            </div>
          )}
        </div>
      )}

      {governance && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            Governance matrix <span style={{ color: '#6b7280' }}>(derived from code)</span>
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '4px 8px' }}>Action type</th>
                <th style={{ padding: '4px 8px' }}>Risk</th>
                <th style={{ padding: '4px 8px' }}>Human approval</th>
                <th style={{ padding: '4px 8px' }}>Suppressed target</th>
                <th style={{ padding: '4px 8px' }}>Executable here</th>
                <th style={{ padding: '4px 8px' }}>Undo</th>
              </tr>
            </thead>
            <tbody>
              {governance.action_types.map((a) => (
                <tr key={a.action_type} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>
                    {a.action_type}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{a.risk_level}</td>
                  <td style={{ padding: '4px 8px' }}>
                    {a.requires_human_approval ? 'required' : '—'}
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    {a.blocked_when_suppressed ? 'blocked' : 'allowed'}
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    {a.executable_in_deployment ? 'yes' : 'fenced off'}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{a.rollback_supported ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 8 }}>
            Kill switch: {governance.kill_switch.semantics}
          </div>
        </div>
      )}

      {syncHistory && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            Integration sync history <span style={{ color: '#6b7280' }}>(CRM read syncs)</span>
          </h2>
          {syncHistory.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              No syncs yet — a CRM read sync records its run here once the worker runs.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '4px 8px' }}>Started</th>
                  <th style={{ padding: '4px 8px' }}>Finished</th>
                  <th style={{ padding: '4px 8px' }}>Status</th>
                  <th style={{ padding: '4px 8px' }}>Synced</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                      {s.started_at ? new Date(s.started_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                      {s.finished_at ? new Date(s.finished_at).toLocaleString() : '—'}
                    </td>
                    <td
                      style={{
                        padding: '4px 8px',
                        color:
                          s.status === 'completed'
                            ? '#047857'
                            : s.status === 'failed'
                              ? '#b91c1c'
                              : '#b45309',
                      }}
                    >
                      {s.status}
                    </td>
                    <td style={{ padding: '4px 8px', color: '#6b7280' }}>
                      {Object.keys(s.stats).length ? JSON.stringify(s.stats) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {opportunities && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            Opportunities <span style={{ color: '#6b7280' }}>(synced from CRM)</span>
          </h2>
          {opportunities.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No opportunities synced yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '4px 8px' }}>Name</th>
                  <th style={{ padding: '4px 8px' }}>Stage</th>
                  <th style={{ padding: '4px 8px' }}>Amount</th>
                  <th style={{ padding: '4px 8px' }}>Account</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 8px' }}>{o.name}</td>
                    <td style={{ padding: '4px 8px' }}>{o.stage ?? '—'}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {o.amount === null ? '—' : o.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>
                      {o.account_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {runPlans && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            Runs <span style={{ color: '#6b7280' }}>(each run is a reviewable unit)</span>
          </h2>
          {runPlans.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              No runs yet — click &quot;Run Mira&quot; to generate a reviewable plan.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '4px 8px' }}>When</th>
                  <th style={{ padding: '4px 8px' }}>Objective</th>
                  <th style={{ padding: '4px 8px' }}>Actions</th>
                  <th style={{ padding: '4px 8px' }}>Awaiting</th>
                  <th style={{ padding: '4px 8px' }}>Approved</th>
                  <th style={{ padding: '4px 8px' }}>Rejected</th>
                  <th style={{ padding: '4px 8px' }}>Executed</th>
                  <th style={{ padding: '4px 8px' }}>Review</th>
                </tr>
              </thead>
              <tbody>
                {runPlans.map((r) => {
                  const expanded = runDetail?.run.id === r.run_id;
                  return (
                    <Fragment key={r.run_id}>
                      <tr
                        onClick={() => toggleRunDetail(r.run_id)}
                        style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                        title="Show this run's action timeline"
                      >
                        <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#9ca3af' }}>{expanded ? '▾' : '▸'}</span>{' '}
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '4px 8px' }}>{r.objective}</td>
                        <td style={{ padding: '4px 8px' }}>
                          {r.rollup.total}
                          <span style={{ color: '#9ca3af' }}>
                            {' '}
                            (
                            {Object.entries(r.rollup.action_types)
                              .map(
                                ([k, v]) => `${k.replace('crm.', '').replace('.create', '')}:${v}`,
                              )
                              .join(', ')}
                            )
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '4px 8px',
                            color: r.rollup.proposed > 0 ? '#b45309' : '#6b7280',
                          }}
                        >
                          {r.rollup.proposed}
                        </td>
                        <td style={{ padding: '4px 8px' }}>{r.rollup.approved}</td>
                        <td style={{ padding: '4px 8px' }}>{r.rollup.rejected}</td>
                        <td style={{ padding: '4px 8px' }}>{r.rollup.executed}</td>
                        <td style={{ padding: '4px 8px' }}>
                          {r.fully_reviewed ? (
                            <span style={{ color: '#047857' }}>✓ complete</span>
                          ) : (
                            <span style={{ color: '#b45309' }}>in progress</span>
                          )}
                        </td>
                      </tr>
                      {expanded && runDetail && (
                        <tr style={{ background: '#fafafa' }}>
                          <td colSpan={8} style={{ padding: '4px 8px 10px 24px' }}>
                            {runDetail.actions.length === 0 ? (
                              <span style={{ color: '#6b7280' }}>
                                No actions were proposed in this run.
                              </span>
                            ) : (
                              <ol style={{ margin: '4px 0', paddingLeft: 16, lineHeight: 1.7 }}>
                                {runDetail.actions.map((a) => (
                                  <li key={a.id}>
                                    <span style={{ fontFamily: 'monospace' }}>{a.action_type}</span>{' '}
                                    <span style={{ color: '#9ca3af' }}>({a.risk_level})</span> →{' '}
                                    {a.target_ref}{' '}
                                    <span
                                      style={{
                                        color:
                                          a.approval_status === 'approved'
                                            ? '#047857'
                                            : a.approval_status === 'rejected'
                                              ? '#b91c1c'
                                              : '#b45309',
                                      }}
                                    >
                                      {a.approval_status}
                                    </span>
                                    {a.execution_status !== 'pending' && (
                                      <span style={{ color: '#6b7280' }}>
                                        {' '}
                                        / {a.execution_status}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {scorecards && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            Governance scorecards <span style={{ color: '#6b7280' }}>(by action type × risk)</span>
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '4px 8px' }}>Segment</th>
                <th style={{ padding: '4px 8px' }}>Approved</th>
                <th style={{ padding: '4px 8px' }}>Rejected</th>
                <th style={{ padding: '4px 8px' }}>Executed</th>
                <th style={{ padding: '4px 8px' }}>Rolled back</th>
                <th style={{ padding: '4px 8px' }}>Approval rate</th>
                <th style={{ padding: '4px 8px' }}>Top reject reasons</th>
              </tr>
            </thead>
            <tbody>
              {scorecards.segments.map((s) => (
                <tr key={s.segment} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>
                    {s.segment}
                    {s.autonomy_indicator.meets_threshold && (
                      <span
                        title="Read-only indicator; V1 grants no autonomy"
                        style={{ color: '#047857' }}
                      >
                        {' '}
                        ✓ trusted
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{s.metrics.actions.approved}</td>
                  <td style={{ padding: '4px 8px' }}>{s.metrics.actions.rejected}</td>
                  <td style={{ padding: '4px 8px' }}>{s.metrics.actions.executed}</td>
                  <td style={{ padding: '4px 8px' }}>{s.metrics.actions.rolled_back}</td>
                  <td style={{ padding: '4px 8px' }}>
                    {s.metrics.approval_rate === null
                      ? '—'
                      : `${Math.round(s.metrics.approval_rate * 100)}%`}
                  </td>
                  <td style={{ padding: '4px 8px', color: '#6b7280' }}>
                    {Object.entries(s.metrics.reject_reasons)
                      .map(([k, v]) => `${k}:${v}`)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            &quot;✓ trusted&quot; is a read-only indicator of where review could later be relaxed
            under an explicit earned-autonomy policy. V1 grants no autonomy — every action requires
            human approval.
          </div>
        </div>
      )}

      {auditTrail && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            Audit trail — {auditTrail.total} entries (newest first)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '4px 8px' }}>When</th>
                <th style={{ padding: '4px 8px' }}>Actor</th>
                <th style={{ padding: '4px 8px' }}>Action</th>
                <th style={{ padding: '4px 8px' }}>Subject</th>
                <th style={{ padding: '4px 8px' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {auditTrail.events.map((e, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{e.actor_ref}</td>
                  <td style={{ padding: '4px 8px', fontWeight: 600 }}>{e.action}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>
                    {e.subject_ref}
                  </td>
                  <td style={{ padding: '4px 8px', color: '#6b7280' }}>
                    {Object.keys(e.detail).length ? JSON.stringify(e.detail) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preflight && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            Preflight report — simulated, <strong>{preflight.writes_performed} writes</strong>{' '}
            performed
          </h2>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
            {preflight.accounts_considered} accounts considered · {preflight.proposals.length}{' '}
            would-be proposals · {preflight.excluded_suppressed.length} suppressed contact(s)
            excluded
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '4px 8px' }}>Would write</th>
                <th style={{ padding: '4px 8px' }}>Target</th>
                <th style={{ padding: '4px 8px' }}>Risk</th>
                <th style={{ padding: '4px 8px' }}>Subject</th>
              </tr>
            </thead>
            <tbody>
              {preflight.proposals.map((p) => (
                <tr key={p.plan.idempotency_key} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 8px' }}>
                    {p.plan.system}/{p.plan.object}
                  </td>
                  <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>
                    {p.target_ref}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{p.risk_level}</td>
                  <td style={{ padding: '4px 8px' }}>
                    {String(p.plan.properties['hs_task_subject'] ?? '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preflight.excluded_suppressed.length > 0 && (
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>
              Excluded (suppressed): {preflight.excluded_suppressed.join(', ')}
            </div>
          )}
        </div>
      )}

      {notice && (
        <div
          role="alert"
          style={{
            ...box,
            marginBottom: 12,
            borderColor: notice.kind === 'error' ? '#fca5a5' : '#a7f3d0',
            background: notice.kind === 'error' ? '#fef2f2' : '#ecfdf5',
            fontSize: 13,
          }}
        >
          {notice.text}
        </div>
      )}

      {decision && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>
            {decision.kind === 'approve'
              ? 'Approve'
              : decision.kind === 'rollback'
                ? 'Undo write (archives the CRM object)'
                : 'Reject'}
            {decision.ids.length > 1 ? ` ${decision.ids.length} actions` : ''} — why? (required;
            this becomes a training label)
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={decision.reasonCode}
              onChange={(e) => setDecision({ ...decision, reasonCode: e.target.value })}
              style={{ padding: 6, fontSize: 13 }}
            >
              {(decision.kind === 'approve' ? APPROVE_REASON_CODES : REJECT_REASON_CODES).map(
                (code) => (
                  <option key={code} value={code}>
                    {code.replaceAll('_', ' ')}
                  </option>
                ),
              )}
            </select>
            <input
              placeholder={
                decision.reasonCode === 'other' ? 'note (required for "other")' : 'note (optional)'
              }
              value={decision.note}
              onChange={(e) => setDecision({ ...decision, note: e.target.value })}
              style={{ padding: 6, fontSize: 13, flex: 1, minWidth: 200 }}
            />
            <button
              style={
                busy || (decision.reasonCode === 'other' && !decision.note.trim())
                  ? btnDisabled
                  : btnPrimary
              }
              disabled={busy || (decision.reasonCode === 'other' && !decision.note.trim())}
              onClick={() => void confirmDecision()}
            >
              Confirm {decision.kind}
            </button>
            <button style={btn} onClick={() => setDecision(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {history && (
        <div style={{ ...box, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>Decision history</h2>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>No decisions recorded yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '4px 8px' }}>Decision</th>
                  <th style={{ padding: '4px 8px' }}>Reason</th>
                  <th style={{ padding: '4px 8px' }}>Approver</th>
                  <th style={{ padding: '4px 8px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((d) => (
                  <tr key={d.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 600 }}>{d.label}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {String(d.detail['reason_code'] ?? '')}
                      {d.detail['note'] ? ` — ${String(d.detail['note'])}` : ''}
                    </td>
                    <td style={{ padding: '4px 8px' }}>{String(d.detail['approver_ref'] ?? '')}</td>
                    <td
                      style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}
                      title={d.subject_ref}
                    >
                      {d.subject_ref.replace('agent_action:', '').slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectableProposed.length > 0 && (
        <div
          style={{
            ...box,
            marginBottom: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <span style={{ color: '#6b7280' }}>{selected.size} selected</span>
          <button
            style={selected.size > 0 && !busy ? btnPrimary : btnDisabled}
            disabled={selected.size === 0 || busy}
            onClick={() =>
              setDecision({
                ids: [...selected],
                kind: 'approve',
                reasonCode: APPROVE_REASON_CODES[0],
                note: '',
              })
            }
          >
            Approve selected
          </button>
          <button
            style={selected.size > 0 && !busy ? btn : btnDisabled}
            disabled={selected.size === 0 || busy}
            onClick={() =>
              setDecision({
                ids: [...selected],
                kind: 'reject',
                reasonCode: REJECT_REASON_CODES[0],
                note: '',
              })
            }
          >
            Reject selected
          </button>
          <button
            style={btn}
            onClick={() => setSelected(new Set(selectableProposed.map((a) => a.id)))}
          >
            Select all proposed
          </button>
          {selected.size > 0 && (
            <button style={btn} onClick={() => setSelected(new Set())}>
              Clear
            </button>
          )}
        </div>
      )}

      <div style={box}>
        {actions.length === 0 ? (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            No actions yet. Click “Run Mira” to generate CRM-task proposals.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '6px 8px', width: 24 }}></th>
                <th style={{ padding: '6px 8px' }}>Channel</th>
                <th style={{ padding: '6px 8px' }}>Risk</th>
                <th style={{ padding: '6px 8px' }}>Target</th>
                <th style={{ padding: '6px 8px' }}>Evidence</th>
                <th style={{ padding: '6px 8px' }}>Status</th>
                <th style={{ padding: '6px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const row = toApprovalRow(a);
                const canApprove = a.approval_status === 'proposed';
                const canExecute =
                  a.approval_status === 'approved' && a.execution_status !== 'executed';
                const rows = [
                  <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        type="checkbox"
                        aria-label={`select ${a.id}`}
                        disabled={!canApprove || busy}
                        checked={selected.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.channel}</td>
                    <td style={{ padding: '6px 8px' }}>{row.risk}</td>
                    <td
                      style={{
                        padding: '6px 8px',
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: 12,
                      }}
                    >
                      {row.target}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{row.evidenceCount} refs</td>
                    <td style={{ padding: '6px 8px' }}>{row.status}</td>
                    <td style={{ padding: '6px 8px', display: 'flex', gap: 6 }}>
                      <button
                        style={canApprove && !busy ? btnPrimary : btnDisabled}
                        disabled={!canApprove || busy}
                        onClick={() =>
                          setDecision({
                            ids: [a.id],
                            kind: 'approve',
                            reasonCode: APPROVE_REASON_CODES[0],
                            note: '',
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        style={canApprove && !busy ? btn : btnDisabled}
                        disabled={!canApprove || busy}
                        onClick={() =>
                          setDecision({
                            ids: [a.id],
                            kind: 'reject',
                            reasonCode: REJECT_REASON_CODES[0],
                            note: '',
                          })
                        }
                      >
                        Reject
                      </button>
                      {/* Execute stays disabled until approved; a 409 from the API is surfaced, never assumed success. */}
                      <button
                        style={canExecute && !busy ? btnPrimary : btnDisabled}
                        disabled={!canExecute || busy}
                        onClick={() =>
                          act(() => client!.execute(a.id), 'Action executed — CRM write-back done.')
                        }
                      >
                        Execute
                      </button>
                      {/* REGR-1: rejections export an anonymized regression candidate. */}
                      {a.approval_status === 'rejected' && (
                        <button
                          style={busy ? btnDisabled : btn}
                          disabled={busy}
                          onClick={() => void exportRegression(a.id)}
                        >
                          Export regression
                        </button>
                      )}
                      {/* UNDO-1: executed writes can be undone with a mandatory reason. */}
                      {a.execution_status === 'executed' && (
                        <button
                          style={busy ? btnDisabled : btn}
                          disabled={busy}
                          onClick={() =>
                            setDecision({
                              ids: [a.id],
                              kind: 'rollback',
                              reasonCode: REJECT_REASON_CODES[0],
                              note: '',
                            })
                          }
                        >
                          Undo write
                        </button>
                      )}
                      <button
                        style={busy ? btnDisabled : btn}
                        disabled={busy}
                        onClick={() => void togglePreview(a.id)}
                      >
                        {preview?.id === a.id ? 'Hide preview' : 'Preview write'}
                      </button>
                      {/* WHY-1: the deterministic rationale + data freshness. */}
                      <button
                        style={busy ? btnDisabled : btn}
                        disabled={busy}
                        onClick={() => void toggleRationale(a.id)}
                      >
                        {rationale?.id === a.id ? 'Hide why' : 'Why'}
                      </button>
                    </td>
                  </tr>,
                ];
                if (rationale?.id === a.id) {
                  const r = rationale.data;
                  rows.push(
                    <tr key={`${a.id}-why`}>
                      <td colSpan={7} style={{ padding: '8px 12px', background: '#f8fafc' }}>
                        {r.account ? (
                          <>
                            <div style={{ fontSize: 12, marginBottom: 6, color: '#374151' }}>
                              <strong>{r.account.name}</strong>
                              {r.account.industry ? ` · ${r.account.industry}` : ''}
                              {r.account.employee_count
                                ? ` · ${r.account.employee_count} employees`
                                : ''}
                              {r.account.region ? ` · ${r.account.region}` : ''}
                              {r.score && (
                                <span>
                                  {' '}
                                  · score <strong>{r.score.combined}</strong> (fit {r.score.fit},
                                  timing {r.score.timing})
                                </span>
                              )}
                            </div>
                            <ul style={{ fontSize: 12, margin: '4px 0', paddingLeft: 18 }}>
                              {r.evidence.map((e) => (
                                <li key={e.source_ref}>{e.claim}</li>
                              ))}
                            </ul>
                            {r.freshness && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: r.freshness.stale_since_proposal ? '#b91c1c' : '#6b7280',
                                }}
                              >
                                Data last updated {r.freshness.age_days}d ago
                                {r.freshness.stale_since_proposal
                                  ? ' — ⚠ the CRM record changed AFTER this was proposed; re-run Mira before approving.'
                                  : '.'}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: '#b91c1c' }}>
                            Target account not found — the CRM record may have been deleted since
                            this was proposed.
                          </div>
                        )}
                      </td>
                    </tr>,
                  );
                }
                if (preview?.id === a.id) {
                  const p = preview.data;
                  rows.push(
                    <tr key={`${a.id}-preview`}>
                      <td colSpan={7} style={{ padding: '8px 12px', background: '#f9fafb' }}>
                        <div style={{ fontSize: 12, marginBottom: 6, color: '#374151' }}>
                          Exact {p.plan.system} write → <strong>{p.plan.object}</strong> (
                          {p.plan.operation}) ·{' '}
                          {p.would_execute ? (
                            <span style={{ color: '#047857' }}>would execute</span>
                          ) : (
                            <span style={{ color: '#b91c1c' }}>
                              blocked: {p.denial_reason ?? 'unknown'}
                            </span>
                          )}
                          {p.idempotent_replay_expected && (
                            <span> · already executed — re-run is an idempotent replay</span>
                          )}
                        </div>
                        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                          <tbody>
                            {Object.entries(p.plan.properties).map(([k, v]) => (
                              <tr key={k}>
                                <td
                                  style={{
                                    padding: '2px 12px 2px 0',
                                    fontFamily: 'ui-monospace, monospace',
                                    color: '#6b7280',
                                    verticalAlign: 'top',
                                  }}
                                >
                                  {k}
                                </td>
                                <td style={{ padding: '2px 0', whiteSpace: 'pre-wrap' }}>
                                  {String(v)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>,
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
        V1 scope: HubSpot CRM tasks/notes only. Every side-effect requires human approval. No emails
        are sent.
      </p>
    </main>
  );
}
