'use client';

/**
 * GTM-OS demo console (temporary route) — a founder-facing review surface over
 * the Client Zero Sales Closer mock spine.
 *
 * IMPORTANT — what this demo is:
 *   - It is TYPE-ALIGNED to the closer mock spine schema
 *     (`packages/agents/src/closer`) and renders synthetic, PRE-AUTHORED
 *     `CloserWorkflowRun` fixtures. It does NOT execute `runCloserWorkflow` in
 *     the browser — approve/reject swap between pre-authored outcome runs.
 *   - Mock-safe by construction: the ONLY controls are a human approve/reject
 *     gate. There is no send/dial/SMS/WhatsApp/email/post/publish control and
 *     nothing here triggers a live external action or a live CRM write.
 *   - Synthetic, PII-safe fixtures only (example.com, masked contact).
 *
 * PR #138 (`/operator`) remains the canonical operator console; this
 * `/gtm-os-demo` route is a temporary, spine-typed demo surface.
 */

import { useMemo, useState } from 'react';
import {
  appointmentStatusLabel,
  canApprove,
  canReject,
  crmStatusLabel,
  GTM_OS_SCENARIOS,
  proofReceipt,
  runTimeline,
  selectRun,
  STATE_LABELS,
  type GtmOsDecision,
  type GtmOsScenario,
} from '../../lib/gtmOsConsoleViewModel';

const C = {
  gray: '#57606a',
  border: '#d0d7de',
  green: '#1a7f37',
  greenBg: '#dafbe1',
  amber: '#9a6700',
  amberBg: '#fff8c5',
  red: '#cf222e',
  redBg: '#ffebe9',
  blue: '#0969da',
  panel: '#ffffff',
};

const panel: React.CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: 16,
  marginTop: 16,
};

function complianceBadge(scenario: GtmOsScenario): React.CSSProperties {
  const blocked = scenario.blocked;
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: blocked ? '#82071e' : C.amber,
    background: blocked ? C.redBg : C.amberBg,
    border: `1px solid ${blocked ? C.red : C.amber}`,
  };
}

function complianceLabel(scenario: GtmOsScenario): string {
  return scenario.blocked ? 'Blocked' : 'Human review required';
}

function decisionStyle(decision: GtmOsDecision): React.CSSProperties {
  const color = decision === 'approve' ? C.green : decision === 'reject' ? C.red : C.gray;
  return { color, fontWeight: 600, textTransform: 'capitalize' };
}

export default function GtmOsDemoPage() {
  const scenarios = useMemo(() => GTM_OS_SCENARIOS, []);
  const [selectedId, setSelectedId] = useState<string>(scenarios[0]?.id ?? '');
  // Per-scenario decision state.
  const [decisions, setDecisions] = useState<Record<string, GtmOsDecision>>({});

  const selected = scenarios.find((s) => s.id === selectedId) ?? scenarios[0];
  if (!selected) {
    return <main style={{ padding: 24 }}>No fixture scenarios available.</main>;
  }

  const decision: GtmOsDecision = decisions[selected.id] ?? 'pending';
  const run = selectRun(selected, decision);
  const approveGate = canApprove(selected, decision);
  const rejectGate = canReject(selected, decision);
  const receipt = proofReceipt(run);
  const timeline = runTimeline(run);

  function decide(action: 'approve' | 'reject') {
    setDecisions((prev) => ({ ...prev, [selected!.id]: action }));
  }

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      {/* Mock-safe banner — always visible. */}
      <div
        role="status"
        style={{
          background: C.redBg,
          border: `2px solid ${C.red}`,
          borderRadius: 6,
          padding: '10px 14px',
          fontWeight: 800,
          fontSize: 14,
          color: '#82071e',
          letterSpacing: 0.5,
          marginBottom: 16,
          textAlign: 'center',
        }}
      >
        MOCK ONLY · NO LIVE SEND · NO REAL CRM — synthetic fixture data; no outreach is ever sent and
        no live CRM is written.
      </div>

      <h1 style={{ marginBottom: 4 }}>GTM-OS Operator Console (demo)</h1>
      <p style={{ color: C.gray, marginTop: 0, fontSize: 14 }}>
        Review a synthetic Sales Closer run, inspect its compliance state and blocked reasons, and
        approve or reject it. Type-aligned to the closer mock spine schema; the run timeline below is
        the sequence of states the pre-authored run visited. Approving never sends outreach or writes
        to a CRM.
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Scenario list */}
        <nav style={{ flex: '1 1 240px', minWidth: 220 }}>
          <h2 style={{ fontSize: 14, color: C.gray }}>Fixture runs</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {scenarios.map((s) => {
              const d = decisions[s.id] ?? 'pending';
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setSelectedId(s.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 10,
                      marginBottom: 6,
                      borderRadius: 6,
                      border: `1px solid ${s.id === selected.id ? C.gray : C.border}`,
                      background: s.id === selected.id ? '#f6f8fa' : C.panel,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{s.title}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <span style={complianceBadge(s)}>{complianceLabel(s)}</span>
                      <span style={decisionStyle(d)}>{d === 'pending' ? 'pending' : d + 'd'}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Detail */}
        <section style={{ flex: '2 1 540px', minWidth: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{selected.title}</h2>
            <span style={complianceBadge(selected)}>{complianceLabel(selected)}</span>
          </div>

          {/* Blocked reasons / clear */}
          {selected.blocked ? (
            <div style={{ ...panel, background: C.redBg, border: `2px solid ${C.red}` }}>
              <strong style={{ color: '#82071e' }}>Blocked — cannot advance</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: '#82071e' }}>
                {selected.blockedReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ ...panel, background: C.greenBg, border: `1px solid ${C.green}` }}>
              <span style={{ color: C.green }}>
                No hard compliance blockers — {selected.compliance.reason}
              </span>
            </div>
          )}

          {/* Lead detail */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Lead detail</h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.gray,
                  border: `1px solid ${C.border}`,
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
              <Field label="Company" value={selected.leadDetail.company} />
              <Field label="Location" value={selected.leadDetail.location} />
              <Field label="Business type" value={selected.leadDetail.businessType ?? '—'} />
              <Field
                label="Source"
                value={`${selected.leadDetail.source} (risk: ${selected.leadDetail.sourceRisk})`}
              />
              <Field label="Contact role" value={selected.leadDetail.contactRole ?? '—'} />
              <Field label="Contact (masked)" value={selected.leadDetail.contactEmailMasked ?? '—'} />
              <Field label="Phone (masked)" value={selected.leadDetail.contactPhoneMasked ?? '—'} />
              <Field label="Domain" value={selected.leadDetail.contactDomain ?? '—'} />
              <Field label="Contact basis" value={selected.leadDetail.contactBasis} />
              <Field label="Consent status" value={selected.leadDetail.consentStatus} />
              <Field label="Fit score" value={String(selected.leadDetail.fitScore)} />
            </dl>
          </div>

          {/* Operator decision — the ONLY action surface */}
          <div style={panel}>
            <h3 style={{ marginTop: 0 }}>Operator decision</h3>
            <p style={{ color: C.gray, marginTop: 0, fontSize: 13 }}>
              Human gating only. Approving records a mock decision and selects the approved run — it
              does not send anything or write to a CRM.
            </p>
            {decision !== 'pending' ? (
              <p style={decisionStyle(decision)}>
                This run was {decision === 'approve' ? 'approved' : 'rejected'}.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => decide('approve')}
                  disabled={!approveGate.allowed}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    fontWeight: 600,
                    cursor: approveGate.allowed ? 'pointer' : 'not-allowed',
                    background: approveGate.allowed ? C.green : '#d0d7de',
                    color: approveGate.allowed ? '#fff' : C.gray,
                  }}
                >
                  Approve run
                </button>
                <button
                  onClick={() => decide('reject')}
                  disabled={!rejectGate.allowed}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: `1px solid ${C.red}`,
                    fontWeight: 600,
                    cursor: rejectGate.allowed ? 'pointer' : 'not-allowed',
                    background: C.panel,
                    color: C.red,
                  }}
                >
                  Reject run
                </button>
                {!approveGate.allowed && approveGate.reason ? (
                  <span style={{ color: C.red, fontSize: 13 }}>
                    Approve disabled: {approveGate.reason}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Run timeline */}
          <div style={panel}>
            <h3 style={{ marginTop: 0 }}>Run timeline</h3>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {timeline.map((step) => (
                <li
                  key={step.state}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 0',
                    opacity: step.reached ? 1 : 0.4,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      flex: '0 0 auto',
                      background: step.reached
                        ? step.state === 'compliance_blocked' || step.state === 'rejected'
                          ? C.red
                          : C.green
                        : C.border,
                      outline: step.current ? `2px solid ${C.blue}` : 'none',
                    }}
                  />
                  <span style={{ fontWeight: step.current ? 700 : 400 }}>{step.label}</span>
                  {step.current ? (
                    <span style={{ fontSize: 11, color: C.blue, fontWeight: 700 }}>CURRENT</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>

          {/* Appointment + CRM (mock) */}
          <div style={panel}>
            <h3 style={{ marginTop: 0 }}>Appointment &amp; CRM writeback (mock)</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              <Field label="Appointment status" value={appointmentStatusLabel(run)} />
              <Field label="CRM writeback status" value={crmStatusLabel(run)} />
            </div>
          </div>

          {/* Proof report / receipt */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Proof report</h3>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: receipt.ready ? C.green : C.amber,
                }}
              >
                {receipt.ready ? 'PROOF READY' : `FINAL STATE: ${STATE_LABELS[receipt.finalState]}`}
              </span>
            </div>
            <p style={{ color: C.gray, fontSize: 13 }}>{receipt.summary}</p>
            <ol style={{ marginTop: 8, paddingLeft: 18 }}>
              {receipt.events.map((e) => (
                <li key={e.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: C.gray }}>
                    {e.kind} · {e.occurredAt}
                  </div>
                  <div>{e.summaryPublic}</div>
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
      <dt style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#57606a' }}>
        {label}
      </dt>
      <dd style={{ margin: '2px 0 0', fontSize: 14 }}>{value}</dd>
    </div>
  );
}
