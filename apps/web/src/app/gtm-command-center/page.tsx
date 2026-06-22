/**
 * `/gtm-command-center` — the visible, integrated GTM Command Center.
 *
 * One screen that proves the B1–B6 mock GTM system works end-to-end from a
 * single deterministic, PII-safe run (the `budget_wheels_demo` / Tenant Zero
 * sandbox):
 *
 *   audience/signal → assembly island (compliance → approval) → dry-run channel
 *   engine → CRM-lite timeline → TrustOps analytics → enterprise release gates →
 *   proof/workspace attribution → no-live-egress attestation → Alta parity
 *   scorecard.
 *
 * Async server component. ALL B1–B6 data comes from the SERVER-ONLY adapter
 * `lib/server/gtmCommandCenterData.ts`, which runs the REAL `@cognitia/agents`
 * modules — there is no structural mirror of lane semantics in this app. The
 * only logic in this file's view layer is the auditable parity scorecard
 * (`computeParityScorecard`), computed over the real-module output.
 *
 * MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII — the banner
 * below is shown persistently. There are NO send / call / SMS / WhatsApp / ad
 * controls anywhere on this page. No client component imports `@cognitia/agents`.
 */

import { loadCommandCenterData } from '../../lib/server/gtmCommandCenterData.js';
import { computeParityScorecard } from '../../lib/gtmCommandCenterViewModel.js';

const muted = { color: '#57606a' } as const;
const card = {
  border: '1px solid #d0d7de',
  borderRadius: 8,
  padding: 16,
  margin: '16px 0',
} as const;
const th = { padding: 6, textAlign: 'left' as const, borderBottom: '2px solid #d0d7de' };
const td = { padding: 6, borderBottom: '1px solid #eaeef2', verticalAlign: 'top' as const };
const table = { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 };
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } as const;

const toneColor: Record<'success' | 'warning' | 'danger', string> = {
  success: '#1a7f37',
  warning: '#9a6700',
  danger: '#cf222e',
};

function Bool({ value, trueIsGood = true }: { value: boolean; trueIsGood?: boolean }) {
  const good = trueIsGood ? value : !value;
  return (
    <strong style={{ color: good ? toneColor.success : toneColor.danger }}>{String(value)}</strong>
  );
}

export default async function GtmCommandCenterPage() {
  const data = await loadCommandCenterData();
  const parity = computeParityScorecard(data);

  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: 24, lineHeight: 1.55 }}>
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
        {data.banner}
      </div>

      <h1 style={{ fontSize: 28, marginBottom: 4 }}>GTM Command Center</h1>
      <p style={muted}>
        Integrated, end-to-end proof of the B1–B6 mock GTM system on one screen: audience → assembly
        (compliance/approval) → dry-run channel engine → CRM-lite → TrustOps → release gates →
        proof/attribution. Tenant <code style={mono}>{data.workspaceId}</code> (sandbox). Every
        value is produced by the real <code style={mono}>@cognitia/agents</code> modules, is mock
        and PII-safe; there is no live send, no real CRM write, and no send/call/SMS/WhatsApp/ad
        control on this page.
      </p>

      {/* Headline scorecard */}
      <section
        style={{
          ...card,
          background: parity.pass ? '#dafbe1' : '#ffebe9',
          borderColor: parity.pass ? '#1a7f37' : '#cf222e',
        }}
      >
        <h2 style={{ fontSize: 20, marginTop: 0 }}>
          Alta implementation-parity score:{' '}
          <span style={{ color: parity.pass ? toneColor.success : toneColor.danger }}>
            {parity.score}/100
          </span>{' '}
          <span style={{ fontSize: 14, ...muted }}>(threshold {parity.threshold})</span>
        </h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Capability dimension</th>
              <th style={th}>Weight</th>
              <th style={th}>Checks passing</th>
              <th style={th}>Earned</th>
            </tr>
          </thead>
          <tbody>
            {parity.dimensions.map((d) => (
              <tr key={d.key}>
                <td style={td}>{d.label}</td>
                <td style={td}>{d.weight}</td>
                <td style={td}>
                  {d.checks.filter((c) => c.ok).length}/{d.checks.length}
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{d.earned}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13, marginBottom: 4 }}>
          This measures implemented, tested, visible <strong>mock/dry-run</strong> surface breadth —
          not live-automation readiness. Still intentionally out of scope:
        </p>
        <ul style={{ ...muted, fontSize: 13, margin: '4px 0' }}>
          {parity.remaining.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      {/* B4 — audience / signal ranking */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>1 · Audience &amp; signal builder (lawful)</h2>
        <table style={table}>
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
            {data.audience.ranked.map((p) => (
              <tr key={p.id}>
                <td style={{ ...td, ...mono }}>{p.id}</td>
                <td style={td}>{p.companyName}</td>
                <td style={td}>{p.source}</td>
                <td style={td}>{p.score.score.toFixed(3)}</td>
                <td style={{ ...td, ...muted }}>{p.evidenceTags.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13 }}>
          Rejected (unlawful source):{' '}
          {data.audience.rejected.map((r) => `${r.id} — ${r.reason}`).join(' · ')}
        </p>
      </section>

      {/* B1 + B2 — assembly islands + dry-run channel plan */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          2 · Assembly islands → compliance / approval → dry-run channel engine
        </h2>
        {data.leads.map(({ lead, console: c, channelPlan }) => (
          <div
            key={lead.id}
            style={{ margin: '12px 0', paddingBottom: 12, borderBottom: '1px solid #eaeef2' }}
          >
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>
              {c.company}{' '}
              <span style={{ color: toneColor[c.badge.tone], fontWeight: 700 }}>
                [{c.badge.label}]
              </span>
            </h3>
            <p style={{ ...muted, fontSize: 13, margin: '2px 0' }}>
              Compliance: {c.complianceLabel} · Approval: {c.approvalLabel} · Proofs: {c.proofCount}
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
            {channelPlan.length > 0 ? (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Channel</th>
                    <th style={th}>Mode</th>
                    <th style={th}>Sent</th>
                    <th style={th}>Live status</th>
                    <th style={th}>Preview target</th>
                  </tr>
                </thead>
                <tbody>
                  {channelPlan.map((a) => (
                    <tr key={a.planRef}>
                      <td style={td}>{a.channel}</td>
                      <td style={{ ...td, fontWeight: 700 }}>DRY-RUN</td>
                      <td style={{ ...td, color: toneColor.success, fontWeight: 700 }}>
                        {String(a.sent)}
                      </td>
                      <td style={{ ...td, color: toneColor.danger, fontWeight: 700 }}>
                        {a.wouldSendIfLive.liveStatus}
                      </td>
                      <td style={{ ...td, ...mono }}>
                        {a.wouldSendIfLive.target} — {a.wouldSendIfLive.summary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ ...muted, fontSize: 13 }}>
                No channel actions planned — lead cannot advance (halted before outreach).
              </p>
            )}
          </div>
        ))}
      </section>

      {/* B3 — CRM-lite + timeline */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          3 · CRM-lite records &amp; operator timeline (mock, idempotent)
        </h2>
        <table style={table}>
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
            {data.crm.records.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, ...mono }}>{r.id}</td>
                <td style={td}>{r.workspaceId}</td>
                <td style={td}>{r.prospectId}</td>
                <td style={td}>{r.appointmentRef ?? '—'}</td>
                <td style={td}>{r.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13, marginBottom: 4 }}>
          Idempotent on repeat upsert: <Bool value={data.crm.idempotentRepeat} />. Timeline:
        </p>
        <ol style={{ ...muted, fontSize: 13, margin: '4px 0 0 18px' }}>
          {data.crm.timeline.map((e) => (
            <li key={e.seq}>
              <code style={mono}>{e.prospectId}</code> {e.kind} · {e.outcome} — {e.summary}
            </li>
          ))}
        </ol>
      </section>

      {/* B5 — TrustOps */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>4 · TrustOps analytics</h2>
        <p style={{ margin: '4px 0' }}>
          Trust score: <strong>{data.trustOps.trustScore.score}/100</strong> · Approval coverage:{' '}
          {(data.trustOps.metrics.approvalCoverage * 100).toFixed(0)}% · No live egress:{' '}
          <Bool value={data.trustOps.metrics.egress.noLiveEgress} />
        </p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Trust-score component</th>
              <th style={th}>Weight</th>
              <th style={th}>Ratio</th>
              <th style={th}>Earned</th>
            </tr>
          </thead>
          <tbody>
            {data.trustOps.trustScore.components.map((c) => (
              <tr key={c.key}>
                <td style={td}>{c.label}</td>
                <td style={td}>{c.weight}</td>
                <td style={td}>{c.ratio.toFixed(2)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{c.earned}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13 }}>
          Funnel — leads {data.trustOps.metrics.funnel.leadsReceived} · compliance pass/blocked{' '}
          {data.trustOps.metrics.funnel.compliancePass}/
          {data.trustOps.metrics.funnel.complianceBlock} · approved/pending{' '}
          {data.trustOps.metrics.funnel.approvalApproved}/
          {data.trustOps.metrics.funnel.approvalPending} · CRM writes{' '}
          {data.trustOps.metrics.funnel.crmWritten} · proof events{' '}
          {data.trustOps.metrics.funnel.proofEventsRecorded}
        </p>
      </section>

      {/* B6 — release gates */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>5 · Enterprise release gates (fail closed)</h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Stage</th>
              <th style={th}>Passed</th>
              <th style={th}>Missing conditions</th>
            </tr>
          </thead>
          <tbody>
            {data.releaseGates.map((g) => (
              <tr key={g.stage}>
                <td style={td}>{g.stage}</td>
                <td style={td}>
                  <Bool value={g.passed} />
                </td>
                <td style={{ ...td, ...muted }}>{g.missing.length ? g.missing.join(', ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Proof / workspace attribution */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>6 · Proof &amp; workspace attribution trace</h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Workspace</th>
              <th style={th}>Prospect</th>
              <th style={th}>Company</th>
              <th style={th}>Proof kind</th>
              <th style={th}>Summary (public)</th>
            </tr>
          </thead>
          <tbody>
            {data.proofTrace.map((p, i) => (
              <tr key={`${p.prospectId}-${i}`}>
                <td style={{ ...td, ...mono }}>{p.workspaceId}</td>
                <td style={{ ...td, ...mono }}>{p.prospectId}</td>
                <td style={td}>{p.company}</td>
                <td style={td}>{p.kind}</td>
                <td style={{ ...td, ...muted }}>{p.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13 }}>
          Backed by the real integrated run packet (PR #159):{' '}
          <Bool value={data.integration.complete} /> — all {data.integration.present.length}{' '}
          required sections present.
        </p>
      </section>

      {/* No-live-egress + why live is blocked */}
      <section style={{ ...card, background: '#fff8c5', borderColor: '#d4a72c' }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          7 · No-live-egress attestation &amp; why live is blocked
        </h2>
        <p style={{ margin: '4px 0' }}>
          <strong>{data.egress.mode}</strong> — {data.egress.statement}
        </p>
        <ul style={{ margin: '4px 0' }}>
          {data.whyLiveBlocked.map((why) => (
            <li key={why}>{why}</li>
          ))}
        </ul>
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Required for controlled-live readiness</h3>
        <ul style={{ margin: '4px 0' }}>
          {data.controlledLiveRequirements.map((req) => (
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
