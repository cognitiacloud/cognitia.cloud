/**
 * `/brain-console` — the Operator Brain Panel.
 *
 * A visible, mock-safe view of the agent brain's harness state: the selected
 * task, the selected provider/model, every provider's enabled/disabled state,
 * the policy decision, fallback routing, the ledger hash / proofRef, the set of
 * disabled real providers, and local-only readiness.
 *
 * Safety posture (V1):
 *   - There is NO live brain harness. The panel renders a deterministic,
 *     PII-safe snapshot from the pure view-model (`lib/brainConsoleViewModel`).
 *   - No client component imports a real model provider or vendor SDK; this
 *     page imports only the pure view-model — no network, no key reads.
 *   - No send / live buttons exist. The panel is read-only.
 *
 * Persistent banner shown on every render:
 *   MOCK ONLY / NO REAL MODEL CALLS / NO LIVE OUTREACH / NO RAW PII
 */

import {
  demoBrainHarnessSnapshot,
  toBrainConsoleView,
  type Tone,
} from '../../lib/brainConsoleViewModel';

const muted = { color: '#57606a' } as const;
const card = {
  border: '1px solid #d0d7de',
  borderRadius: 8,
  padding: 16,
  margin: '16px 0',
} as const;
const th = { padding: 6, textAlign: 'left' as const, borderBottom: '2px solid #d0d7de' };
const td = { padding: 6, borderBottom: '1px solid #eaeef2', verticalAlign: 'top' as const };

const toneColor: Record<Tone, string> = {
  success: '#1a7f37',
  warning: '#9a6700',
  danger: '#cf222e',
  neutral: '#57606a',
};

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: '#fff',
        background: toneColor[tone],
      }}
    >
      {label}
    </span>
  );
}

export default function BrainConsolePage() {
  const view = toBrainConsoleView(demoBrainHarnessSnapshot());

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24, lineHeight: 1.55 }}>
      {/* Persistent banner — always shown, never conditional. */}
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

      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Operator Brain Panel</h1>
      <p style={muted}>
        Mock-safe view of the agent brain harness for tenant <code>{view.workspaceId}</code>{' '}
        {view.sandbox ? '(sandbox)' : ''}. There is no live harness in V1: this panel renders a
        deterministic, PII-safe snapshot from a pure view-model — no real model call, no live
        outreach, no client-side provider import.
      </p>

      {/* Safety invariant */}
      <section
        style={{
          ...card,
          background: view.mockSafe ? '#dafbe1' : '#ffebe9',
          borderColor: view.mockSafe ? '#1a7f37' : '#cf222e',
        }}
      >
        <strong>Mock-safe: </strong>
        <Badge
          label={view.mockSafe ? 'YES' : 'NO'}
          tone={view.mockSafe ? 'success' : 'danger'}
        />{' '}
        <span style={muted}>{view.noRealModelStatement}</span>
      </section>

      {/* Selected task + provider */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>1 · Selected task &amp; provider</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ ...td, width: 200, fontWeight: 600 }}>Task</td>
              <td style={td}>
                {view.taskLabel}
                <div style={{ ...muted, fontSize: 13 }}>{view.taskObjective}</div>
              </td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 600 }}>Selected provider / model</td>
              <td style={td}>
                <code>{view.selectedProviderLabel}</code> <Badge {...view.selectedProviderState} />
              </td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 600 }}>Policy decision</td>
              <td style={td}>
                <Badge {...view.policyBadge} /> <span style={muted}>{view.policyReason}</span>
              </td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 600 }}>Fallback used</td>
              <td style={td}>{view.fallbackLabel}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Providers + enabled/disabled state */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>2 · Providers (real providers disabled)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Provider</th>
              <th style={th}>Model</th>
              <th style={th}>Kind</th>
              <th style={th}>State</th>
              <th style={th}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {view.providers.map((p) => (
              <tr key={p.id}>
                <td style={td}>
                  <code>{p.id}</code>
                  {p.selected ? ' ◀ selected' : ''}
                </td>
                <td style={td}>{p.model}</td>
                <td style={td}>{p.kind}</td>
                <td style={{ ...td, color: toneColor[p.tone], fontWeight: 700 }}>{p.stateLabel}</td>
                <td style={{ ...td, ...muted, fontSize: 13 }}>{p.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13 }}>
          Disabled real providers:{' '}
          {view.disabledRealProviders.length
            ? view.disabledRealProviders.map((id) => <code key={id}>{id} </code>)
            : '—'}
        </p>
      </section>

      {/* Ledger proof + local-only readiness */}
      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>3 · Ledger proof &amp; local-only readiness</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ ...td, width: 200, fontWeight: 600 }}>Ledger hash</td>
              <td style={td}>
                <code>{view.ledgerHash}</code>
              </td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 600 }}>Proof ref</td>
              <td style={td}>
                <code>{view.proofRef}</code>
              </td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 600 }}>Local-only ready</td>
              <td style={td}>
                <Badge
                  label={view.localOnlyReady ? 'Ready' : 'Not ready'}
                  tone={view.localOnlyReady ? 'success' : 'danger'}
                />{' '}
                <span style={muted}>{view.localOnlyStatement}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ ...muted, fontSize: 13 }}>
          Prompts and outputs are referenced by hash only — no raw content, no PII is stored or
          rendered. There are no send or live-action controls on this panel.
        </p>
      </section>
    </main>
  );
}
