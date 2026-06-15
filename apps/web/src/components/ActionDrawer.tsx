'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { consoleClient } from '../lib/useConsole';
import {
  ApiError,
  APPROVE_REASON_CODES,
  REJECT_REASON_CODES,
  type AgentActionView,
  type DecisionRationaleView,
  type DecisionReasonInput,
  type ExecutionPreviewView,
} from '../lib/apiClient';
import { actionTypeLabel } from '../lib/runsView';
import { Chip, statusTone } from './ui';

export interface ActionDrawerProps {
  actionId: string;
  /** Current approval status (proposed | approved | rejected). */
  approvalStatus: string;
  /** Current execution status (pending | executing | executed | failed | rolled_back). */
  executionStatus: string;
  actionType?: string;
  riskLevel?: string;
  targetRef?: string;
  onClose: () => void;
  /** Called after a successful decision so the parent surface can re-fetch. */
  onChanged?: () => void;
}

type Mode = 'approve' | 'reject' | 'rollback' | null;

const REASON_LABELS: Record<string, string> = {
  accurate_and_relevant: 'Accurate and relevant',
  high_value_target: 'High-value target',
  meets_playbook: 'Meets the playbook',
  wrong_target: 'Wrong target',
  factually_wrong: 'Factually wrong',
  tone_off_brand: 'Tone off-brand',
  policy_or_risk: 'Policy or risk',
  duplicate_or_stale: 'Duplicate or stale',
  other: 'Other (note required)',
};
const reasonLabel = (c: string): string => REASON_LABELS[c] ?? c;

interface Notice {
  tone: 'danger' | 'ok' | 'warn';
  text: string;
}

interface Context {
  rationale: DecisionRationaleView | null;
  preview: ExecutionPreviewView | null;
  loaded: boolean;
}

export function ActionDrawer(props: ActionDrawerProps) {
  const { actionId, onClose, onChanged } = props;
  const [approval, setApproval] = useState(props.approvalStatus);
  const [execution, setExecution] = useState(props.executionStatus);
  const [ctx, setCtx] = useState<Context>({ rationale: null, preview: null, loaded: false });
  const [mode, setMode] = useState<Mode>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Load the read-only context (WHY-1 rationale + GOV-1 write preview). Both are
  // viewer-safe; either may be unavailable, which we surface honestly.
  useEffect(() => {
    let live = true;
    setCtx({ rationale: null, preview: null, loaded: false });
    const api = consoleClient();
    Promise.allSettled([api.actionRationale(actionId), api.previewAction(actionId)]).then(
      ([r, p]) => {
        if (!live) return;
        setCtx({
          rationale: r.status === 'fulfilled' ? r.value : null,
          preview: p.status === 'fulfilled' ? p.value : null,
          loaded: true,
        });
      },
    );
    return () => {
      live = false;
    };
  }, [actionId]);

  // Esc closes; focus the close control on mount (dialog affordance).
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyUpdated = useCallback((a: AgentActionView) => {
    setApproval(a.approval_status);
    setExecution(a.execution_status);
  }, []);

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 403) {
        setNotice({
          tone: 'danger',
          text: 'Operator role required — your session can view this action but not decide on it.',
        });
        return;
      }
      if (e.status === 409) {
        setNotice({ tone: 'warn', text: 'This action can no longer change in its current state.' });
        return;
      }
      const payloadMsg =
        e.payload && typeof e.payload === 'object' && 'error' in e.payload
          ? String((e.payload as { error: unknown }).error)
          : null;
      setNotice({ tone: 'danger', text: payloadMsg ?? `Request failed (${e.status}).` });
      return;
    }
    setNotice({ tone: 'danger', text: 'The operator API is unreachable. Try again.' });
  }, []);

  const startMode = (m: Mode) => {
    setMode(m);
    setReasonCode('');
    setNote('');
    setNotice(null);
  };

  const requireNote = reasonCode === 'other';
  const canSubmit = !busy && reasonCode !== '' && !(requireNote && note.trim() === '');

  const submitDecision = async () => {
    if (!mode || !canSubmit) return;
    const reason: DecisionReasonInput = {
      reason_code: reasonCode,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    setBusy(true);
    setNotice(null);
    try {
      const api = consoleClient();
      const updated =
        mode === 'approve'
          ? await api.approve(actionId, reason)
          : mode === 'reject'
            ? await api.reject(actionId, reason)
            : await api.rollback(actionId, reason);
      applyUpdated(updated);
      setMode(null);
      const done =
        mode === 'approve' ? 'Approved.' : mode === 'reject' ? 'Rejected.' : 'Write undone.';
      setNotice({ tone: 'ok', text: done });
      onChanged?.();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const runExecute = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const updated = await consoleClient().execute(actionId);
      applyUpdated(updated);
      setNotice(
        updated.execution_status === 'failed'
          ? { tone: 'danger', text: 'Execution failed — see the run timeline for the error.' }
          : { tone: 'ok', text: 'Executed — the CRM write was performed.' },
      );
      onChanged?.();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const reasonCodes =
    mode === 'approve'
      ? APPROVE_REASON_CODES
      : mode === 'reject' || mode === 'rollback'
        ? REJECT_REASON_CODES
        : [];

  const canApproveOrReject = approval === 'proposed';
  const canExecute = approval === 'approved' && (execution === 'pending' || execution === 'failed');
  const canRollback = execution === 'executed';
  const titleId = 'action-drawer-title';

  return (
    <div
      className="drawer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="drawer-head">
          <div>
            <h2 className="drawer-title" id={titleId}>
              {actionTypeLabel(props.actionType ?? '') || 'Action'}
              {props.riskLevel ? (
                <>
                  {' '}
                  <Chip tone={statusTone(props.riskLevel === 'none' ? 'neutral' : props.riskLevel)}>
                    {props.riskLevel} risk
                  </Chip>
                </>
              ) : null}
            </h2>
            <p className="drawer-sub">
              {props.targetRef ? <span className="mono">{props.targetRef}</span> : actionId}
            </p>
            <div className="chip-row" style={{ marginTop: 8 }}>
              <Chip tone={statusTone(approval)}>{approval}</Chip>
              <Chip tone={statusTone(execution)}>{execution}</Chip>
            </div>
          </div>
          <button ref={closeRef} className="x-btn" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>
              ×
            </span>
          </button>
        </div>

        <div className="drawer-body">
          {notice ? <div className={`notice ${notice.tone}`}>{notice.text}</div> : null}

          {!ctx.loaded ? (
            <div className="skel" style={{ height: 90 }} aria-label="Loading action context" />
          ) : (
            <>
              <Rationale rationale={ctx.rationale} />
              <WritePreview preview={ctx.preview} />
            </>
          )}
        </div>

        <div className="drawer-foot">
          {mode ? (
            <div style={{ width: '100%' }}>
              <div className="field">
                <label className="field-label" htmlFor="reason-code">
                  {mode === 'approve' ? 'Approve' : mode === 'reject' ? 'Reject' : 'Undo'} — reason
                  code
                </label>
                <select
                  id="reason-code"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                >
                  <option value="">Select a reason…</option>
                  {reasonCodes.map((c) => (
                    <option key={c} value={c}>
                      {reasonLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="reason-note">
                  Note {requireNote ? '(required)' : '(optional)'}
                </label>
                <textarea
                  id="reason-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={requireNote ? 'A note is required when the reason is “Other”.' : ''}
                />
                {requireNote && note.trim() === '' ? (
                  <span className="field-hint">A note is required when the reason is “Other”.</span>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={mode === 'approve' ? 'btn primary' : 'btn danger'}
                  disabled={!canSubmit}
                  onClick={submitDecision}
                >
                  {busy
                    ? 'Working…'
                    : mode === 'approve'
                      ? 'Confirm approve'
                      : mode === 'reject'
                        ? 'Confirm reject'
                        : 'Confirm undo'}
                </button>
                <button className="btn ghost" onClick={() => setMode(null)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          ) : canApproveOrReject || canExecute || canRollback ? (
            <>
              {canApproveOrReject ? (
                <>
                  <button
                    className="btn primary"
                    onClick={() => startMode('approve')}
                    disabled={busy}
                  >
                    Approve
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => startMode('reject')}
                    disabled={busy}
                  >
                    Reject
                  </button>
                </>
              ) : null}
              {canExecute ? (
                <button className="btn primary" onClick={runExecute} disabled={busy}>
                  {busy ? 'Working…' : execution === 'failed' ? 'Retry execute' : 'Execute write'}
                </button>
              ) : null}
              {canRollback ? (
                <button
                  className="btn danger"
                  onClick={() => startMode('rollback')}
                  disabled={busy}
                >
                  Undo write
                </button>
              ) : null}
            </>
          ) : (
            <span className="muted" style={{ fontSize: 12.5 }}>
              No decision available in this state.
            </span>
          )}
        </div>
      </aside>
    </div>
  );
}

function Rationale({ rationale }: { rationale: DecisionRationaleView | null }) {
  return (
    <div className="drawer-section">
      <h3>Evidence &amp; rationale</h3>
      {!rationale ? (
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          No rationale is available for this action.
        </p>
      ) : (
        <>
          {rationale.freshness?.stale_since_proposal ? (
            <div className="notice warn" style={{ marginBottom: 10 }}>
              Source data changed since this was proposed — re-check before approving.
            </div>
          ) : null}
          {rationale.account ? (
            <dl className="kv" style={{ marginBottom: 12 }}>
              <dt>Account</dt>
              <dd>{rationale.account.name}</dd>
              {rationale.account.industry ? (
                <>
                  <dt>Industry</dt>
                  <dd>{rationale.account.industry}</dd>
                </>
              ) : null}
              {rationale.account.region ? (
                <>
                  <dt>Region</dt>
                  <dd>{rationale.account.region}</dd>
                </>
              ) : null}
              {rationale.score ? (
                <>
                  <dt>Fit / timing</dt>
                  <dd>
                    {pct(rationale.score.fit)} / {pct(rationale.score.timing)} ·{' '}
                    <strong>{pct(rationale.score.combined)}</strong> combined
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
            {rationale.evidence_refs_on_action} evidence ref
            {rationale.evidence_refs_on_action === 1 ? '' : 's'} on this action
          </div>
          {rationale.evidence.length === 0 ? (
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              No grounding facts recorded.
            </p>
          ) : (
            rationale.evidence.map((e, i) => (
              <div key={`${e.source_ref}-${i}`} className="evidence-item">
                <div className="evidence-claim">{e.claim}</div>
                <div className="evidence-src">
                  <span className="mono">{e.source_ref}</span> · score {pct(e.score)}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

function WritePreview({ preview }: { preview: ExecutionPreviewView | null }) {
  return (
    <div className="drawer-section">
      <h3>Write preview</h3>
      {!preview ? (
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          No write preview is available for this action.
        </p>
      ) : (
        <>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            <Chip tone={preview.would_execute ? 'ok' : 'neutral'}>
              {preview.would_execute ? 'would execute' : 'blocked'}
            </Chip>
            {preview.denial_reason ? <Chip tone="warn">{preview.denial_reason}</Chip> : null}
            {preview.idempotent_replay_expected ? (
              <Chip tone="neutral">idempotent replay</Chip>
            ) : null}
          </div>
          <dl className="kv">
            <dt>System</dt>
            <dd>{preview.plan.system}</dd>
            <dt>Object</dt>
            <dd>{preview.plan.object}</dd>
            <dt>Operation</dt>
            <dd>{preview.plan.operation}</dd>
            {Object.entries(preview.plan.properties).map(([k, v]) => (
              <DProp key={k} k={k} v={v} />
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

function DProp({ k, v }: { k: string; v: string | number }) {
  return (
    <>
      <dt className="mono">{k}</dt>
      <dd>{String(v)}</dd>
    </>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
