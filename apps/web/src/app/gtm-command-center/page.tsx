/**
 * `/gtm-command-center` — the visible, integrated GTM Command Center.
 *
 * One screen that proves the B1–B6 mock GTM system works end-to-end from a
 * single deterministic, PII-safe run (the `budget_wheels_demo` / Tenant Zero
 * sandbox), laid out as ten explicit operator panels:
 *
 *   1 Lead intake & workspace trace · 2 Audience / signal ranking ·
 *   3 Compliance gate · 4 Human approval gate · 5 Dry-run channel plan ·
 *   6 Mock CRM-lite timeline · 7 Proof / action trace · 8 TrustOps metrics ·
 *   9 Enterprise release-gate status · 10 Why live is blocked.
 *
 * Server component, no IO. ALL logic lives in (and is unit-tested by)
 * `gtmCommandCenterViewModel.ts`. The persistent banner
 * `MOCK · DRY-RUN · NO LIVE SEND · NO REAL CRM · NO RAW PII` is shown on every
 * view. There are NO send / call / SMS / WhatsApp / ad controls anywhere on
 * this page; blocked and pending leads visibly cannot advance.
 */

import { buildCommandCenterView } from '../../lib/gtmCommandCenterViewModel.js';

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

/** Small "can this lead advance past this gate?" pill. */
function ProceedPill({ canProceed, blockedText }: { canProceed: boolean; blockedText: string }) {
  return canProceed ? (
    <strong style={{ color: toneColor.success }}>ADVANCES</strong>
  ) : (
    <strong style={{ color: toneColor.danger }}>{blockedText}</strong>
  );
}

export default function GtmCommandCenterPage() {
  const view = buildCommandCenterView();
  const { parity } = view;

  // A lead may advance past the human-approval gate only when it has a non-empty
  // dry-run channel plan — which the view-model emits only for leads that both
  // cleared compliance and were human-approved (see `planForLead`/`canProceed`).
  const proceedOf = (l: (typeof view.leads)[number]) => l.channelPlan.length > 0;

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
        Integrated, end-to-end proof of the B1–B6 mock GTM system on one screen, as ten operator
        panels: lead intake → audience/signal ranking → compliance gate → human approval gate →
        dry-run channel plan → mock CRM-lite → proof/action trace → TrustOps → release gates → why
        live is blocked. Tenant <code style={mono}>{view.workspaceId}</code> (sandbox). Every value
        is mock and PII-safe; there is no live send, no real CRM write, and no
        send/call/SMS/WhatsApp/ad control on this page.
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

      {/* 1 — Lead intake & workspace trace (B1) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>1 · Lead intake &amp; workspace trace</h2>
        <p style={{ ...muted, fontSize: 13, marginTop: 0 }}>
          Every lead enters attributed to a single sandbox workspace. Status is computed by the
          assembly island; nothing here can advance without clearing the gates below.
        </p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Lead</th>
              <th style={th}>Company</th>
              <th style={th}>Workspace</th>
              <th style={th}>Source risk</th>
              <th style={th}>Consent basis</th>
              <th style={th}>Fit</th>
              <th style={th}>Status</th>
              <th style={th}>Final state</th>
            </tr>
          </thead>
          <tbody>
            {view.leads.map(({ lead, console: c }) => (
              <tr key={lead.id}>
                <td style={{ ...td, ...mono }}>{lead.id}</td>
                <td style={td}>{lead.companyName}</td>
                <td style={{ ...td, ...mono }}>{lead.packet.workspace.workspaceId}</td>
                <td style={td}>{lead.packet.prospect.sourceRisk}</td>
                <td style={td}>{lead.packet.prospect.consentStatus}</td>
                <td style={td}>{lead.packet.prospect.fitScore.toFixed(2)}</td>
                <td style={{ ...td, color: toneColor[c.badge.tone], fontWeight: 700 }}>
                  {c.badge.label}
                </td>
                <td style={{ ...td, ...muted }}>{lead.packet.finalState}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 2 — Audience / signal ranking (B4) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>2 · Audience &amp; signal ranking (lawful)</h2>
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
            {view.audience.ranked.map((p) => (
              <tr key={p.id}>
                <td style={{ ...td, ...mono }}>{p.id}</td>
                <td style={td}>{p.companyName}</td>
                <td style={td}>{p.source}</td>
                <td style={td}>{p.score.toFixed(3)}</td>
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

      {/* 3 — Compliance gate (B1) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>3 · Compliance gate</h2>
        <p style={{ ...muted, fontSize: 13, marginTop: 0 }}>
          A lead that fails compliance is <strong>halted before the approval gate</strong> — it can
          never reach a channel plan or a CRM write.
        </p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Lead</th>
              <th style={th}>Company</th>
              <th style={th}>Compliance result</th>
              <th style={th}>Past this gate</th>
            </tr>
          </thead>
          <tbody>
            {view.leads.map(({ lead, console: c }) => {
              const cleared = lead.packet.compliance.passed && !lead.packet.compliance.blocked;
              return (
                <tr key={lead.id}>
                  <td style={{ ...td, ...mono }}>{lead.id}</td>
                  <td style={td}>{c.company}</td>
                  <td style={{ ...td, color: cleared ? toneColor.success : toneColor.danger }}>
                    {c.complianceLabel}
                  </td>
                  <td style={td}>
                    <ProceedPill canProceed={cleared} blockedText="BLOCKED — HALTED" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 4 — Human approval gate (B1) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>4 · Human approval gate</h2>
        <p style={{ ...muted, fontSize: 13, marginTop: 0 }}>
          Compliance-cleared leads still require an explicit human approval. Pending leads are
          <strong> held</strong> and cannot advance to outreach. No automated step can approve on a
          human&apos;s behalf.
        </p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Lead</th>
              <th style={th}>Company</th>
              <th style={th}>Approval decision</th>
              <th style={th}>Past this gate</th>
            </tr>
          </thead>
          <tbody>
            {view.leads.map(({ lead, console: c }) => {
              const cleared = lead.packet.compliance.passed && !lead.packet.compliance.blocked;
              const approved = lead.packet.approval.status === 'approved';
              const decision = !cleared ? 'n/a — halted at compliance' : c.approvalLabel;
              return (
                <tr key={lead.id}>
                  <td style={{ ...td, ...mono }}>{lead.id}</td>
                  <td style={td}>{c.company}</td>
                  <td
                    style={{
                      ...td,
                      color: approved ? toneColor.success : toneColor.warning,
                    }}
                  >
                    {decision}
                  </td>
                  <td style={td}>
                    <ProceedPill
                      canProceed={proceedOf(view.leads.find((l) => l.lead.id === lead.id)!)}
                      blockedText={cleared ? 'PENDING — HELD' : 'BLOCKED — HALTED'}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 5 — Dry-run channel plan (B2) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>5 · Dry-run channel plan (never sends)</h2>
        <p style={{ ...muted, fontSize: 13, marginTop: 0 }}>
          Plans are emitted only for leads that cleared compliance <em>and</em> were human-approved.
          Every action is <code style={mono}>mode=dry_run</code>,{' '}
          <code style={mono}>sent=false</code>, and its live status is{' '}
          <code style={mono}>BLOCKED</code>. There is no control to execute any of them.
        </p>
        {view.leads.map(({ lead, console: c, channelPlan }) => (
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
              <p style={{ color: toneColor.danger, fontSize: 13, fontWeight: 600 }}>
                No channel actions planned — lead cannot advance (halted before outreach
                {c.blockedReason ? `: ${c.blockedReason}` : ''}).
              </p>
            )}
          </div>
        ))}
      </section>

      {/* 6 — Mock CRM-lite timeline (B3) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          6 · Mock CRM-lite records &amp; operator timeline (idempotent)
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
          Idempotent on repeat upsert: <Bool value={view.crm.idempotentRepeat} />. Blocked/pending
          leads write nothing. Timeline:
        </p>
        <ol style={{ ...muted, fontSize: 13, margin: '4px 0 0 18px' }}>
          {view.crm.timeline.map((e) => (
            <li key={e.seq}>
              <code style={mono}>{e.recordId}</code> {e.kind} · {e.prospectId} → {e.stage}
            </li>
          ))}
        </ol>
      </section>

      {/* 7 — Proof / action trace (B1) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          7 · Proof &amp; action trace (workspace-attributed)
        </h2>
        <h3 style={{ fontSize: 15, margin: '8px 0 4px' }}>Ordered operator action trace</h3>
        {view.leads.map(({ lead, console: c }) => (
          <div key={lead.id} style={{ margin: '4px 0 8px' }}>
            <strong style={{ fontSize: 13 }}>
              {c.company} <span style={{ color: toneColor[c.badge.tone] }}>[{c.badge.label}]</span>
            </strong>
            <ol style={{ ...muted, fontSize: 13, margin: '2px 0 0 18px' }}>
              {c.timeline.map((row) => (
                <li key={row.step}>
                  <strong>{row.phase}</strong> — {row.outcome}
                  {row.detail ? `: ${row.detail}` : ''}
                </li>
              ))}
            </ol>
          </div>
        ))}
        <h3 style={{ fontSize: 15, margin: '12px 0 4px' }}>Proof trace</h3>
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

      {/* 8 — TrustOps metrics / report (B5) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>8 · TrustOps metrics &amp; report</h2>
        <p style={{ margin: '4px 0' }}>
          Trust score: <strong>{view.trustOps.trustScore.score}/100</strong> · Approval coverage:{' '}
          {(view.trustOps.metrics.approvalCoverage * 100).toFixed(0)}% · No live egress:{' '}
          <Bool value={view.trustOps.metrics.egress.noLiveEgress} />
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

      {/* 9 — Enterprise release-gate status (B6) */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          9 · Enterprise release-gate status (fail closed)
        </h2>
        <table style={table}>
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

      {/* 10 — Why live is blocked */}
      <section style={{ ...card, background: '#fff8c5', borderColor: '#d4a72c' }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>
          10 · Why live is blocked (no-live-egress attestation)
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
