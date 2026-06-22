/**
 * `/gtm-os-integrated-demo` — the visible, end-to-end integrated GTM operator
 * demo. Async server component: it awaits the SERVER-ONLY adapter
 * (`lib/server/gtmIntegratedDemoData.ts`), which runs the REAL `@cognitia/agents`
 * modules (B1–B6) and returns the data rendered below. No client component
 * imports `@cognitia/agents`.
 *
 *   audience/signal → compliance/approval → dry-run channel plan →
 *   CRM-lite → TrustOps metrics → release gates → proof/trace.
 *
 * MOCK ONLY / DRY-RUN ONLY / NO LIVE SEND / NO REAL CRM — banner shown always.
 */

import { loadIntegratedDemoData } from '../../lib/server/gtmIntegratedDemoData.js';

const muted = { color: '#57606a' } as const;
const card = {
  border: '1px solid #d0d7de',
  borderRadius: 8,
  padding: 16,
  margin: '16px 0',
} as const;
const th = { padding: 6, textAlign: 'left' as const, borderBottom: '2px solid #d0d7de' };
const td = { padding: 6, borderBottom: '1px solid #eaeef2', verticalAlign: 'top' as const };

const toneColor: Record<'success' | 'warning' | 'danger', string> = {
  success: '#1a7f37',
  warning: '#9a6700',
  danger: '#cf222e',
};

export default async function GtmOsIntegratedDemoPage() {
  const view = await loadIntegratedDemoData();

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 24, lineHeight: 1.55 }}>
      {/* Persistent banner */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: '#0b3d2e',
          color: '#fff',
          fontWeight: 700,
          letterSpacing: 0.4,
          textAlign: 'center',
          padding: '10px 12px',
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        {view.banner}
      </div>

      <h1 style={{ fontSize: 26, marginBottom: 4 }}>GTM-OS — Integrated Operator Demo</h1>
      <p style={muted}>
        End-to-end proof that the integrated GTM system works, rendered from the real{' '}
        <code>@cognitia/agents</code> modules through a server-only adapter. Tenant{' '}
        <code>{view.workspaceId}</code> (sandbox). Every value is mock and PII-safe; no live send,
        no real CRM write.
      </p>

      {/* B4 — audience / signal ranking */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>1 · Audience &amp; signal ranking (lawful)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Prospect</th>
              <th style={th}>Company</th>
              <th style={th}>Source</th>
              <th style={th}>Score</th>
              <th style={th}>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {view.audience.ranked.map((p) => (
              <tr key={p.id}>
                <td style={td}>
                  <code>{p.id}</code>
                </td>
                <td style={td}>{p.companyName}</td>
                <td style={td}>{p.source}</td>
                <td style={td}>{p.score.score.toFixed(2)}</td>
                <td style={td}>{p.evidenceTags.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13 }}>
          Rejected (unlawful source):{' '}
          {view.audience.rejected.map((r) => `${r.id} — ${r.reason}`).join(' · ')}
        </p>
      </section>

      {/* B1 + B2 — per-lead assembly packet + dry-run channel plan */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          2 · Assembly packet → compliance/approval → dry-run channel plan
        </h2>
        {view.leads.map((lead) => {
          const c = lead.console;
          return (
            <div key={lead.id} style={{ margin: '12px 0', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                {lead.company}{' '}
                <span style={{ color: toneColor[c.badge.tone], fontWeight: 700 }}>
                  [{c.badge.label}]
                </span>
              </h3>
              <p style={{ ...muted, fontSize: 13, margin: '2px 0' }}>
                Compliance: {c.complianceLabel} · Approval: {c.approvalLabel} · Proofs:{' '}
                {c.proofCount}
                {c.blockedReason ? ` · Blocked: ${c.blockedReason}` : ''}
              </p>
              <ol style={{ ...muted, fontSize: 13, margin: '4px 0 8px 18px' }}>
                {c.timeline.map((row) => (
                  <li key={row.step}>
                    <strong>{row.phase}</strong> — {row.outcome}
                    {row.detail ? `: ${row.detail}` : ''}
                  </li>
                ))}
              </ol>
              {lead.channelPlan.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Channel</th>
                      <th style={th}>Mode</th>
                      <th style={th}>Sent</th>
                      <th style={th}>Would send (preview, BLOCKED)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lead.channelPlan.map((a) => (
                      <tr key={a.planRef}>
                        <td style={td}>{a.channel}</td>
                        <td style={td}>{a.mode}</td>
                        <td style={{ ...td, color: toneColor.success, fontWeight: 700 }}>
                          {String(a.sent)}
                        </td>
                        <td style={td}>
                          <code>{a.wouldSendIfLive.target}</code> — {a.wouldSendIfLive.summary} (
                          {a.wouldSendIfLive.liveStatus})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ ...muted, fontSize: 13 }}>
                  No channel actions planned — lead halted before outreach (policy:{' '}
                  {lead.policy.allow ? 'allow' : 'deny'}
                  {lead.policy.reasons.length ? ` — ${lead.policy.reasons[0]}` : ''}).
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* B3 — CRM-lite */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>3 · CRM-lite records (mock, idempotent)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Record</th>
              <th style={th}>Workspace</th>
              <th style={th}>Prospect</th>
              <th style={th}>Appt</th>
              <th style={th}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {view.crm.records.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <code>{r.id}</code>
                </td>
                <td style={td}>{r.workspaceId}</td>
                <td style={td}>{r.prospectId}</td>
                <td style={td}>{r.appointmentRef ?? '—'}</td>
                <td style={td}>{r.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13 }}>
          Timeline events recorded: {view.crm.timeline.length}
        </p>
      </section>

      {/* B5 — TrustOps */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>4 · TrustOps metrics &amp; report</h2>
        <p style={{ margin: '4px 0' }}>
          Trust score: <strong>{view.trustOps.score.score}/100</strong> · Approval coverage:{' '}
          {(view.trustOps.metrics.approvalCoverage * 100).toFixed(0)}% · No live egress:{' '}
          <strong>{String(view.trustOps.metrics.egress.noLiveEgress)}</strong>
        </p>
        <pre
          style={{
            background: '#f6f8fa',
            border: '1px solid #d0d7de',
            borderRadius: 6,
            padding: 12,
            fontSize: 12,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {view.trustOps.reportMarkdown}
        </pre>
      </section>

      {/* Proof / action trace — correlated evidence spine over the real packets */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          5 · Proof &amp; action trace (correlated, mock)
        </h2>
        <p style={{ ...muted, fontSize: 13, marginTop: 0 }}>
          One correlated trace per lead, built from the REAL integrated run packets and mapped
          across <strong>lead → compliance → approval → dry-run plan → CRM-lite → TrustOps</strong>.
          Every step shares the lead&apos;s opaque correlation id and references the real underlying
          evidence (proof ids, plan refs, CRM events, trust score). Halted/blocked leads show a
          shorter, honest trace — no fabricated downstream evidence. Packet-derived TrustOps:{' '}
          <strong>{view.proof.trustOps.score}/100</strong> over {view.proof.trustOps.leadsReceived}{' '}
          run(s), approval coverage {(view.proof.trustOps.approvalCoverage * 100).toFixed(0)}%.
        </p>
        {view.proof.traces.map((trace) => (
          <div key={trace.correlationId} style={{ margin: '12px 0' }}>
            <h3 style={{ fontSize: 14, marginBottom: 4 }}>
              <code>{trace.correlationId}</code>{' '}
              <span style={{ color: trace.complete ? toneColor.success : toneColor.warning }}>
                {trace.complete ? '[complete loop]' : '[halted — partial loop]'}
              </span>
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Stage</th>
                  <th style={th}>Lane</th>
                  <th style={th}>Outcome</th>
                  <th style={th}>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {trace.steps.map((step) => (
                  <tr key={step.seq}>
                    <td style={td}>{step.seq}</td>
                    <td style={td}>
                      <strong>{step.stage}</strong>
                    </td>
                    <td style={td}>{step.lane}</td>
                    <td style={td}>{step.outcome}</td>
                    <td style={td}>
                      {step.summary}
                      {step.refs.length > 0 ? (
                        <div style={{ ...muted, fontSize: 12 }}>
                          {step.refs.map((r) => `${r.label}=${r.ref}`).join(' · ')}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ ...muted, fontSize: 12, margin: '4px 0' }}>
              Coverage:{' '}
              {trace.coverage.map((c) => `${c.stage}:${c.present ? '✓' : '—'}`).join('  ')}
            </p>
          </div>
        ))}
      </section>

      {/* B6 — release gates */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>6 · Release gates (fail closed)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Stage</th>
              <th style={th}>Passed</th>
              <th style={th}>Missing conditions</th>
            </tr>
          </thead>
          <tbody>
            {view.releaseGates.map((g) => (
              <tr key={g.stage}>
                <td style={td}>{g.stage}</td>
                <td
                  style={{
                    ...td,
                    color: g.passed ? toneColor.success : toneColor.danger,
                    fontWeight: 700,
                  }}
                >
                  {String(g.passed)}
                </td>
                <td style={td}>{g.missing.length ? g.missing.join(', ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Why live is blocked + what controlled-live requires */}
      <section style={{ ...card, background: '#fff8c5', borderColor: '#d4a72c' }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>7 · Why live automation is blocked</h2>
        <ul style={{ margin: '4px 0' }}>
          {view.whyLiveBlocked.map((why) => (
            <li key={why}>{why}</li>
          ))}
        </ul>
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Required for controlled-live readiness</h3>
        <ul style={{ margin: '4px 0' }}>
          {view.controlledLiveRequirements.map((req) => (
            <li key={req}>{req}</li>
          ))}
        </ul>
        <p style={{ ...muted, fontSize: 13 }}>
          These are organizational/legal gates, not code toggles. Until every one is satisfied and
          recorded, the controlled-live gate stays closed and no live send is possible.
        </p>
      </section>
    </main>
  );
}
