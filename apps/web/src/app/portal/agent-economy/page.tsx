/**
 * Portal → Agent Economy (compliance boundaries).
 *
 * Declares the allowed/forbidden boundaries of the two agents in the Sales Closer
 * compliance layer. Static governance copy — no agent runs here. (Distinct from
 * the internal escrow-lab page at /agent-economy.)
 */

export const metadata = { title: 'Agent Boundaries — Sales Closer' };

interface AgentCard {
  name: string;
  role: string;
  allowed: string[];
  forbidden: string[];
}

const AGENTS: AgentCard[] = [
  {
    name: 'Compliance Guardrail Agent',
    role: 'Enforces the compliance policy; can never override suppression or approve its own risky action.',
    allowed: [
      'Classify source risk',
      'Check channel eligibility',
      'Require human approval',
      'Create compliance log entries',
      'Create proof events',
      'Suggest safer wording',
    ],
    forbidden: [
      'Override DNC / unsubscribe / do-not-contact',
      'Approve its own risky action',
      'Send outreach',
      'Bypass human approval',
    ],
  },
  {
    name: 'Demandara GTM Agent',
    role: 'Prepares human-reviewed prospecting work; never sends or invents contacts.',
    allowed: [
      'Summarize a prospect',
      'Score fit',
      'Draft human-reviewed outreach',
      'Create discovery prep notes',
      'Log proof events',
    ],
    forbidden: [
      'Scrape blocked sources',
      'Send autonomous cold outreach',
      'Bypass unsubscribe / DNC / DNCL',
      'Invent contacts',
      'Enrich sensitive personal data without review',
      'Claim guaranteed results',
    ],
  },
];

function List({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <h4 style={{ margin: '8px 0 4px', color }}>{title}</h4>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 14 }}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AgentBoundariesPage() {
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 24px' }}>
      <p style={{ fontSize: 13, color: '#57606a' }}>
        <a href="/portal/settings">← Settings</a>
      </p>
      <h1 style={{ fontSize: 24 }}>Agent Boundaries</h1>
      <p style={{ color: '#57606a' }}>
        Every outreach path ends at a human approval gate. Agents draft and check; humans approve
        and send.
      </p>

      {AGENTS.map((agent) => (
        <section
          key={agent.name}
          style={{
            border: '1px solid #d0d7de',
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
            background: '#fff',
          }}
        >
          <h3 style={{ margin: '0 0 4px' }}>{agent.name}</h3>
          <p style={{ margin: '0 0 8px', color: '#57606a', fontSize: 14 }}>{agent.role}</p>
          <div style={{ display: 'flex', gap: 24 }}>
            <List title="Allowed" items={agent.allowed} color="#1a7f37" />
            <List title="Forbidden" items={agent.forbidden} color="#cf222e" />
          </div>
        </section>
      ))}

      <p style={{ marginTop: 24, fontSize: 12, color: '#8c959f' }}>
        A Compliance Guardrail Agent cannot approve its own risky action, and a Demandara GTM Agent
        cannot send autonomous outreach — both are enforced in the compliance helpers and their
        tests.
      </p>
    </main>
  );
}
