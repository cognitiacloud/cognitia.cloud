import { checkChannelCompliance, explainComplianceDecision } from '../../lib/compliance';
import { DEMO_PROSPECTS } from '../../lib/complianceFixtures';

/**
 * Discovery.
 *
 * Lists GTM prospects and their compliance posture. A GTM prospect is NOT a
 * consumer car-shopper lead, and it becomes a booked Discovery Session ONLY
 * after a human qualifies it. That distinction is shown in the labels below.
 */

export const metadata = { title: 'Discovery — Sales Closer' };

const STAGE_COPY: Record<string, string> = {
  not_started: 'GTM prospect (not yet researched)',
  researching: 'GTM prospect — researching',
  qualified: 'Qualified — ready for a human to book a Discovery Session',
  booked: 'Discovery Session booked (human-qualified)',
  disqualified: 'Disqualified',
};

const DECISION_COLOR: Record<string, string> = {
  allowed: '#1a7f37',
  human_review_required: '#9a6700',
  blocked: '#cf222e',
};

export default function DiscoveryPage() {
  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
      <p style={{ fontSize: 13, color: '#57606a' }}>
        <a href="/portal/settings">← Settings</a>
      </p>
      <h1 style={{ fontSize: 24 }}>Discovery</h1>
      <p style={{ color: '#57606a' }}>
        These are <strong>Demandara dealership GTM prospects</strong> — business records, not
        consumer car-shopper leads. A prospect becomes a booked <strong>Discovery Session</strong>{' '}
        only after a human qualifies it.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: '8px 6px' }}>Company</th>
            <th style={{ padding: '8px 6px' }}>Stage</th>
            <th style={{ padding: '8px 6px' }}>Consent status</th>
            <th style={{ padding: '8px 6px' }}>Email decision</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_PROSPECTS.map(({ prospect, evidence }) => {
            const email = checkChannelCompliance(prospect, 'email', evidence);
            return (
              <tr
                key={prospect.id}
                style={{ borderBottom: '1px solid #eaeef2', verticalAlign: 'top' }}
              >
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>
                  {prospect.companyName}
                  <div style={{ fontWeight: 400, color: '#8c959f', fontSize: 12 }}>
                    {prospect.city}
                    {prospect.provinceOrState ? `, ${prospect.provinceOrState}` : ''}
                  </div>
                </td>
                <td style={{ padding: '8px 6px', color: '#57606a' }}>
                  {STAGE_COPY[prospect.discoveryStatus]}
                </td>
                <td style={{ padding: '8px 6px' }}>{prospect.consentStatus}</td>
                <td
                  style={{
                    padding: '8px 6px',
                    color: DECISION_COLOR[email.decision],
                    fontWeight: 600,
                  }}
                >
                  {email.decision}
                  <div style={{ fontWeight: 400, color: '#8c959f', fontSize: 12 }}>
                    {explainComplianceDecision(email)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ marginTop: 24, fontSize: 12, color: '#8c959f' }}>
        No outreach is sent from here. AI can draft outreach, but human approval is required before
        sending. SMS, WhatsApp, and AI voice are gated off by default.
      </p>
    </main>
  );
}
