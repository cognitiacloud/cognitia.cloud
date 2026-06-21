'use client';

/**
 * W4 — Operator Console (mock-safe Sales Closer workflow).
 *
 * A human review/gating surface over fixture prospects. The operator inspects a
 * lead, sees its compliance state and blocked reasons, and approves or rejects
 * the workflow. It is mock-safe by construction:
 *   - No live outreach controls — no send/dial/SMS/WhatsApp/email buttons. The
 *     only actions are a human approve/reject gate.
 *   - No live CRM writes — CRM status is a simulated marker (`written: false`).
 *   - Fixture data only (the #97 demo prospects); lead detail is PII-safe
 *     (masked contact / domain only, never raw email/phone).
 *
 * Everything is computed locally from the compliance engine + fixtures; this
 * page makes no network calls.
 */

import { useMemo, useState } from 'react';
import { DEMO_PROSPECTS } from '../../lib/complianceFixtures';
import {
  applyOperatorDecision,
  buildOperatorWorkflowView,
  canApprove,
  canReject,
  OperatorDecisionError,
  type OperatorWorkflowView,
} from '../../lib/operatorConsole';

const OPERATOR = 'operator@example.test';

const COLORS = {
  gray: '#57606a',
  border: '#d0d7de',
  green: '#1a7f37',
  amber: '#9a6700',
  red: '#cf222e',
  redBg: '#ffebe9',
  amberBg: '#fff8c5',
  greenBg: '#dafbe1',
  panel: '#ffffff',
};

function badgeStyle(state: OperatorWorkflowView['complianceState']): React.CSSProperties {
  const map =
    state === 'blocked'
      ? { color: '#82071e', background: COLORS.redBg, border: `1px solid ${COLORS.red}` }
      : { color: COLORS.amber, background: COLORS.amberBg, border: `1px solid ${COLORS.amber}` };
  return {
    ...map,
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  };
}

function complianceLabel(state: OperatorWorkflowView['complianceState']): string {
  return state === 'blocked' ? 'Blocked' : 'Human review required';
}

function decisionStyle(decision: OperatorWorkflowView['decision']): React.CSSProperties {
  const color =
    decision === 'approved' ? COLORS.green : decision === 'rejected' ? COLORS.red : COLORS.gray;
  return { color, fontWeight: 600, textTransform: 'capitalize' };
}

const panel: React.CSSProperties = {
  background: COLORS.panel,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: 16,
  marginTop: 16,
};

export default function OperatorConsolePage() {
  // Build the initial fixture views once.
  const initialViews = useMemo(() => DEMO_PROSPECTS.map((r) => buildOperatorWorkflowView(r)), []);
  const [views, setViews] = useState<OperatorWorkflowView[]>(initialViews);
  const [selectedId, setSelectedId] = useState<string>(initialViews[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = views.find((v) => v.id === selectedId) ?? views[0];

  function decide(action: 'approve' | 'reject') {
    if (!selected) return;
    setError(null);
    try {
      const updated = applyOperatorDecision(selected, action, OPERATOR, note);
      setViews((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setNote('');
      setShowReject(false);
    } catch (err) {
      setError(err instanceof OperatorDecisionError ? err.message : 'Decision failed.');
    }
  }

  if (!selected) {
    return <main style={{ padding: 24 }}>No fixture workflows available.</main>;
  }

  const approveGate = canApprove(selected);
  const rejectGate = canReject(selected);

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      {/* Mock-safe banner — makes the no-send / no-live-CRM contract unmissable. */}
      <div
        role="status"
        style={{
          background: COLORS.amberBg,
          border: `1px solid ${COLORS.amber}`,
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          color: '#7a5c00',
          marginBottom: 16,
        }}
      >
        MOCK ENVIRONMENT — review &amp; gating only. No SMS, calls, WhatsApp, or email are sent. No
        live CRM writes. Fixture data only.
      </div>

      <h1 style={{ marginBottom: 4 }}>Operator Console — Sales Closer</h1>
      <p style={{ color: COLORS.gray, marginTop: 0 }}>
        Review a fixture workflow, inspect its compliance state and blocked reasons, and approve or
        reject it. Approving routes the prospect to a human-gated outreach step — it never sends
        outreach or writes to a CRM.
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Workflow list */}
        <nav style={{ flex: '1 1 260px', minWidth: 240 }}>
          <h2 style={{ fontSize: 14, color: COLORS.gray }}>Fixture workflows</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {views.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => {
                    setSelectedId(v.id);
                    setShowReject(false);
                    setError(null);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 10,
                    marginBottom: 6,
                    borderRadius: 6,
                    border: `1px solid ${v.id === selected.id ? COLORS.gray : COLORS.border}`,
                    background: v.id === selected.id ? '#f6f8fa' : COLORS.panel,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{v.lead.companyName}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    <span style={badgeStyle(v.complianceState)}>
                      {complianceLabel(v.complianceState)}
                    </span>
                    <span style={decisionStyle(v.decision)}>{v.decision}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Detail */}
        <section style={{ flex: '2 1 520px', minWidth: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{selected.lead.companyName}</h2>
            <span style={badgeStyle(selected.complianceState)}>
              {complianceLabel(selected.complianceState)}
            </span>
          </div>

          {/* Blocked reasons — prominent when blocked */}
          {selected.complianceState === 'blocked' ? (
            <div
              style={{
                ...panel,
                background: COLORS.redBg,
                border: `2px solid ${COLORS.red}`,
              }}
            >
              <strong style={{ color: '#82071e' }}>⛔ Blocked — cannot advance</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: '#82071e' }}>
                {selected.blockedReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div
              style={{ ...panel, background: COLORS.greenBg, border: `1px solid ${COLORS.green}` }}
            >
              <span style={{ color: COLORS.green }}>
                No hard compliance blockers — eligible for human-gated review.
              </span>
            </div>
          )}

          {/* Lead fixture detail */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Lead detail</h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: COLORS.gray,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                FIXTURE · PII-SAFE
              </span>
            </div>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginTop: 12,
              }}
            >
              <Field label="Location" value={selected.lead.location} />
              <Field label="Business type" value={selected.lead.businessType ?? '—'} />
              <Field
                label="Source"
                value={`${selected.lead.source} (risk: ${selected.lead.sourceRisk})`}
              />
              <Field label="Contact role" value={selected.lead.contactRole ?? '—'} />
              <Field label="Contact (masked)" value={selected.lead.contactEmailMasked ?? '—'} />
              <Field label="Phone (masked)" value={selected.lead.contactPhoneMasked ?? '—'} />
              <Field label="Contact basis" value={selected.lead.contactBasis} />
              <Field label="Consent status" value={selected.lead.consentStatus} />
              <Field label="Fit score" value={String(selected.lead.fitScore)} />
              <Field label="Package fit" value={selected.lead.packageFit ?? '—'} />
            </dl>
          </div>

          {/* Channel eligibility */}
          <div style={panel}>
            <h3 style={{ marginTop: 0 }}>Channel eligibility</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `2px solid ${COLORS.border}` }}>
                  <th style={{ padding: 6 }}>Channel</th>
                  <th style={{ padding: 6 }}>Status</th>
                  <th style={{ padding: 6 }}>Reasons</th>
                </tr>
              </thead>
              <tbody>
                {selected.channels.map((c) => (
                  <tr key={c.channel} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: 6, fontWeight: 600 }}>{c.channel}</td>
                    <td style={{ padding: 6 }}>{c.status}</td>
                    <td style={{ padding: 6, color: COLORS.gray }}>{c.reasons.join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Operator decision — the ONLY action surface (no send controls) */}
          <div style={panel}>
            <h3 style={{ marginTop: 0 }}>Operator decision</h3>
            <p style={{ color: COLORS.gray, marginTop: 0, fontSize: 13 }}>
              Human gating only — approving records a mock decision and routes to a human-gated
              outreach step. It does not send anything.
            </p>
            {selected.decision !== 'pending' ? (
              <p style={decisionStyle(selected.decision)}>
                This workflow was {selected.decision}
                {selected.decisionNote ? ` — “${selected.decisionNote}”` : ''}.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => decide('approve')}
                    disabled={!approveGate.allowed}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      fontWeight: 600,
                      cursor: approveGate.allowed ? 'pointer' : 'not-allowed',
                      background: approveGate.allowed ? COLORS.green : '#d0d7de',
                      color: approveGate.allowed ? '#fff' : COLORS.gray,
                    }}
                  >
                    Approve workflow
                  </button>
                  <button
                    onClick={() => setShowReject((s) => !s)}
                    disabled={!rejectGate.allowed}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: `1px solid ${COLORS.red}`,
                      fontWeight: 600,
                      cursor: rejectGate.allowed ? 'pointer' : 'not-allowed',
                      background: COLORS.panel,
                      color: COLORS.red,
                    }}
                  >
                    Reject workflow
                  </button>
                </div>
                {!approveGate.allowed && approveGate.reason ? (
                  <p style={{ color: COLORS.red, fontSize: 13 }}>
                    Approve disabled: {approveGate.reason}
                  </p>
                ) : null}
                {showReject ? (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                      Rejection note (optional)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
                      placeholder="Why is this fixture workflow being rejected? (mock)"
                    />
                    <button
                      onClick={() => decide('reject')}
                      style={{
                        marginTop: 8,
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: COLORS.red,
                        color: '#fff',
                      }}
                    >
                      Confirm rejection
                    </button>
                  </div>
                ) : null}
              </>
            )}
            {error ? <p style={{ color: COLORS.red }}>{error}</p> : null}
          </div>

          {/* CRM & appointment (mock) */}
          <div style={panel}>
            <h3 style={{ marginTop: 0 }}>CRM &amp; appointment (mock)</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <Field label={`CRM (${selected.crm.system})`} value="Mock — not written" />
                <p style={{ color: COLORS.gray, fontSize: 12, margin: '4px 0 0' }}>
                  {selected.crm.note}
                </p>
              </div>
              <div>
                <Field label="Appointment" value={selected.appointment.status} />
                <p style={{ color: COLORS.gray, fontSize: 12, margin: '4px 0 0' }}>
                  {selected.appointment.note}
                </p>
              </div>
            </div>
          </div>

          {/* Proof report */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Proof report</h3>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: selected.proofReport.state === 'generated' ? COLORS.green : COLORS.amber,
                }}
              >
                {selected.proofReport.state === 'generated' ? 'GENERATED' : 'PENDING'}
              </span>
            </div>
            <ol style={{ marginTop: 12, paddingLeft: 18 }}>
              {selected.proofReport.log.map((e) => (
                <li key={e.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: COLORS.gray }}>
                    {e.type}
                    {e.decision ? ` · ${e.decision}` : ''} · {e.createdAt}
                  </div>
                  <div>{e.summary}</div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#57606a' }}
      >
        {label}
      </dt>
      <dd style={{ margin: '2px 0 0', fontSize: 14 }}>{value}</dd>
    </div>
  );
}
