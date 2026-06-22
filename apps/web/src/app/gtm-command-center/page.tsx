/**
 * `/gtm-command-center` — the visible, integrated GTM Command Center.
 *
 * One screen that proves the B1–B6 mock GTM system works end-to-end from real,
 * deterministic, PII-safe runs (the `budget_wheels_demo` / Tenant Zero sandbox):
 *
 *   audience/signal → assembly island (compliance → approval) → dry-run channel
 *   engine → CRM-lite timeline → TrustOps analytics → enterprise release gates →
 *   proof/workspace attribution → integrated run packet → no-live-egress
 *   attestation → dual Alta scorecard.
 *
 * Async SERVER component: it awaits the SERVER-ONLY adapter
 * (`lib/server/gtmCommandCenterData.ts`), which runs the REAL `@cognitia/agents`
 * modules (B1–B6 + the integration packet) and returns the data rendered below.
 * No client component imports `@cognitia/agents`. ALL data logic + scoring lives
 * in (and is unit-tested by) the adapter and `gtmCommandCenterViewModel.ts`.
 *
 * MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII — the banner
 * below is shown persistently. There are NO send / call / SMS / WhatsApp / ad
 * controls anywhere on this page.
 */

import { loadCommandCenterData } from '../../lib/server/gtmCommandCenterData.js';

const muted = { color: '#57606a' } as const;
const card = {
  border: '1px solid #d0d7de',
  borderRadius: 8,
  padding: 16,
  margin: '16px 0',
} as const;
const th = { padding: 6, textAlign: 'left' as const, borderBottom: '2px solid #d0d7de' };
const td = { padding: 6, borderBottom: '1px solid #eaeef2', verticalAlign: 'top' as const };
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 };
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
  const view = await loadCommandCenterData();
  const { capabilitySurface: surface, implementationParity: parity } = view;

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
        {view.banner}
      </div>

      <h1 style={{ fontSize: 28, marginBottom: 4 }}>GTM Command Center</h1>
      <p style={muted}>
        Integrated, end-to-end proof of the B1–B6 mock GTM system on one screen, rendered from the
        real <code style={mono}>@cognitia/agents</code> modules through a server-only adapter:
        audience → assembly (compliance/approval) → dry-run channel engine → CRM-lite → TrustOps →
        release gates → proof/attribution → integrated run packet. Tenant{' '}
        <code style={mono}>{view.workspaceId}</code> (sandbox). Every value is mock and PII-safe;
        there is no live send, no real CRM write, and no send/call/SMS/WhatsApp/ad control on this
        page.
      </p>

      {/* Headline scorecard — mock/dry-run CAPABILITY-SURFACE score (may be 100) */}
      <section
        style={{
          ...card,
          background: surface.pass ? '#dafbe1' : '#ffebe9',
          borderColor: surface.pass ? '#1a7f37' : '#cf222e',
        }}
      >
        <h2 style={{ fontSize: 20, marginTop: 0 }}>
          Mock/dry-run capability-surface score:{' '}
          <span style={{ color: surface.pass ? toneColor.success : toneColor.danger }}>
            {surface.score}/100
          </span>{' '}
          <span style={{ fontSize: 14, ...muted }}>(threshold {surface.threshold})</span>
        </h2>
        <p style={{ ...muted, fontSize: 13, marginTop: 0 }}>
          This measures the{' '}
          <strong>
            breadth of Alta&apos;s GTM capability surface implemented as tested, visible,
            mock/dry-run code
          </strong>{' '}
          — every check is an objective structural assertion over real module output. It is{' '}
          <strong>NOT</strong> a live-automation readiness claim, and it is <strong>not</strong> the
          official implementation-parity figure (see below).
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Capability dimension</th>
              <th style={th}>Weight</th>
              <th style={th}>Checks passing</th>
              <th style={th}>Earned</th>
            </tr>
          </thead>
          <tbody>
            {surface.dimensions.map((d) => (
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
        <p style={{ ...muted, fontSize: 13, marginBottom: 4 }}>Still intentionally out of scope:</p>
        <ul style={{ ...muted, fontSize: 13, margin: '4px 0' }}>
          {surface.remaining.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      {/* HONEST official Alta implementation-parity estimate (NOT 100) */}
      <section
        style={{
          ...card,
          background: parity.meetsThreshold ? '#dafbe1' : '#fff8c5',
          borderColor: parity.meetsThreshold ? '#1a7f37' : '#d4a72c',
        }}
      >
        <h2 style={{ fontSize: 20, marginTop: 0 }}>
          Official Alta implementation parity (honest):{' '}
          <span style={{ color: parity.meetsThreshold ? toneColor.success : toneColor.warning }}>
            {parity.score}/100
          </span>{' '}
          <span style={{ fontSize: 14, ...muted }}>
            (threshold {parity.threshold} —{' '}
            {parity.meetsThreshold ? 'met' : `honest ceiling ${parity.honestCeiling}`})
          </span>
        </h2>
        <p style={{ ...muted, fontSize: 13, marginTop: 0 }}>
          A conservative, weighted estimate of real implementation parity. Only axes that genuinely
          hold on this branch are credited; persistence, route-bound enforcement, reachable
          deployment, and live readiness are left at zero because they do not yet exist. This is the
          number the evidence doc cites — deliberately not the capability-surface figure above.
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Implementation axis</th>
              <th style={th}>Weight</th>
              <th style={th}>Status</th>
              <th style={th}>Earned</th>
            </tr>
          </thead>
          <tbody>
            {parity.axes.map((a) => (
              <tr key={a.key}>
                <td style={td}>
                  {a.label}
                  <br />
                  <span style={{ ...muted, fontSize: 12 }}>{a.note}</span>
                </td>
                <td style={td}>{a.weight}</td>
                <td
                  style={{
                    ...td,
                    fontWeight: 700,
                    color:
                      a.status === 'implemented'
                        ? toneColor.success
                        : a.status === 'partial'
                          ? toneColor.warning
                          : toneColor.danger,
                  }}
                >
                  {a.status}
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{a.earned}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Exact blockers to a confident 80+</h3>
        <ul style={{ fontSize: 13, margin: '4px 0' }}>
          {parity.exactBlockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Separate out-of-scope axes</h3>
        <ul style={{ ...muted, fontSize: 13, margin: '4px 0' }}>
          {parity.outOfScope.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>

      {/* Integrated run packet — one verified artifact (PR #159) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          0 · Integrated run packet — one verified artifact composing B1–B6
        </h2>
        <p style={{ ...muted, fontSize: 13, margin: '2px 0' }}>
          <code style={mono}>{view.integrated.packet.schema}</code> · mode{' '}
          <strong>{view.integrated.packet.mode}</strong> · complete{' '}
          <Bool value={view.integrated.completeness.complete} /> · no live egress{' '}
          <Bool value={view.integrated.packet.attestation.noLiveEgress} />
        </p>
        <p style={{ fontSize: 13, margin: '2px 0' }}>
          Sections present ({view.integrated.completeness.present.length}/
          {view.integrated.completeness.present.length +
            view.integrated.completeness.missing.length}
          ):{' '}
          {view.integrated.completeness.present.map((s) => (
            <code key={s} style={{ ...mono, marginRight: 8 }}>
              ✓ {s}
            </code>
          ))}
          {view.integrated.completeness.missing.map((s) => (
            <code key={s} style={{ ...mono, marginRight: 8, color: toneColor.danger }}>
              ✗ {s}
            </code>
          ))}
        </p>
      </section>

      {/* B4 — audience / signal ranking */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>1 · Audience &amp; signal builder (lawful)</h2>
        <table style={tableStyle}>
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
          {view.audience.rejected.map((r) => `${r.id} — ${r.reason}`).join(' · ')}
        </p>
      </section>

      {/* B1 + B2 — assembly islands + dry-run channel plan */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          2 · Assembly islands → compliance / approval → dry-run channel engine
        </h2>
        {view.leads.map((l) => {
          const c = l.console;
          return (
            <div
              key={l.id}
              style={{ margin: '12px 0', paddingBottom: 12, borderBottom: '1px solid #eaeef2' }}
            >
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                {l.company}{' '}
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
              {l.channelPlan.length > 0 ? (
                <table style={tableStyle}>
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
                    {l.channelPlan.map((a) => (
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
                  No channel actions planned — lead cannot advance (policy:{' '}
                  {l.policy.allow ? 'allow' : 'deny'}
                  {l.policy.reasons.length ? ` — ${l.policy.reasons[0]}` : ''}).
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* B3 — CRM-lite + timeline */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          3 · CRM-lite records &amp; operator timeline (mock, idempotent)
        </h2>
        <table style={tableStyle}>
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
          Idempotent on repeat upsert: <Bool value={view.crm.idempotentRepeat} />. Timeline:
        </p>
        <ol style={{ ...muted, fontSize: 13, margin: '4px 0 0 18px' }}>
          {view.crm.timeline.map((e) => (
            <li key={e.seq}>
              <code style={mono}>{e.kind}</code> · {e.prospectId} → {e.outcome} — {e.summary}
            </li>
          ))}
        </ol>
      </section>

      {/* B5 — TrustOps */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>4 · TrustOps analytics</h2>
        <p style={{ margin: '4px 0' }}>
          Trust score: <strong>{view.trustOps.trustScore.score}/100</strong> · Approval coverage:{' '}
          {(view.trustOps.metrics.approvalCoverage * 100).toFixed(0)}% · No live egress:{' '}
          <Bool value={view.trustOps.metrics.egress.noLiveEgress} />
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Trust-score component</th>
              <th style={th}>Weight</th>
              <th style={th}>Ratio</th>
              <th style={th}>Earned</th>
            </tr>
          </thead>
          <tbody>
            {view.trustOps.trustScore.components.map((c) => (
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
          Funnel — leads {view.trustOps.metrics.funnel.leadsReceived} · compliance pass/blocked{' '}
          {view.trustOps.metrics.funnel.compliancePass}/
          {view.trustOps.metrics.funnel.complianceBlock} · approved/pending{' '}
          {view.trustOps.metrics.funnel.approvalApproved}/
          {view.trustOps.metrics.funnel.approvalPending} · CRM writes{' '}
          {view.trustOps.metrics.funnel.crmWritten} · proof events{' '}
          {view.trustOps.metrics.funnel.proofEventsRecorded}
        </p>
      </section>

      {/* B6 — release gates */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>5 · Enterprise release gates (fail closed)</h2>
        <table style={tableStyle}>
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
        <table style={tableStyle}>
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
            {view.proofTrace.map((p, i) => (
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
      </section>

      {/* No-live-egress + why live is blocked */}
      <section style={{ ...card, background: '#fff8c5', borderColor: '#d4a72c' }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          7 · No-live-egress attestation &amp; why live is blocked
        </h2>
        <p style={{ margin: '4px 0' }}>
          <strong>{view.egress.mode}</strong> — {view.egress.statement}
        </p>
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
