'use client';

/**
 * UI-1 — Approval console (V1: CRM write-back only; NO email affordances).
 *
 * Auth: the operator pastes a signed session token (issued per
 * docs/launch/operator-handoff.md step 7). The token goes into the
 * `Authorization: Bearer` header; the API derives tenant + role from it —
 * the browser never supplies a tenant id. 401/403/409 are surfaced explicitly.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiClient,
  ApiError,
  APPROVE_REASON_CODES,
  REJECT_REASON_CODES,
  type AgentActionView,
  type DecisionLabelView,
  type ExecutionPreviewView,
  type PreflightReportView,
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
  // SIM-1: zero-write preflight simulation report.
  const [preflight, setPreflight] = useState<PreflightReportView | null>(null);

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
    // Trust strip is best-effort: a metrics failure never blocks the queue.
    try {
      setMetrics(await client.trustMetrics());
    } catch {
      setMetrics(null);
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
                    </td>
                  </tr>,
                ];
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
