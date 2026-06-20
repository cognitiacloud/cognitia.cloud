import {
  checkChannelCompliance,
  createComplianceProofEvent,
  explainComplianceDecision,
  type ComplianceProofEvent,
} from '../../../lib/compliance';
import { DEMO_PROSPECTS } from '../../../lib/complianceFixtures';

/**
 * Portal → Compliance Proof.
 *
 * Derives compliance proof events by running the policy helpers over the seeded
 * demo prospects (no persistence, no network). This is the proof / action-ledger
 * view for compliance decisions. No raw contact PII appears in summaries.
 */

export const metadata = { title: 'Compliance Proof — Sales Closer' };

function buildEvents(): ComplianceProofEvent[] {
  const events: ComplianceProofEvent[] = [];
  for (const { prospect, evidence } of DEMO_PROSPECTS) {
    events.push(
      createComplianceProofEvent({
        type: 'prospect_normalized',
        prospectId: prospect.id,
        summary: `${prospect.companyName} normalized from source "${prospect.source}".`,
        createdAt: prospect.updatedAt,
      }),
    );

    if (prospect.unsubscribeStatus === 'unsubscribed') {
      events.push(
        createComplianceProofEvent({
          type: 'unsubscribe_recorded',
          prospectId: prospect.id,
          summary: `${prospect.companyName}: unsubscribe recorded — suppressed on all channels.`,
          createdAt: prospect.updatedAt,
        }),
      );
    }
    if (prospect.doNotContact) {
      events.push(
        createComplianceProofEvent({
          type: 'do_not_contact_recorded',
          prospectId: prospect.id,
          summary: `${prospect.companyName}: do-not-contact recorded — suppressed on all channels.`,
          createdAt: prospect.updatedAt,
        }),
      );
    }

    const email = checkChannelCompliance(prospect, 'email', evidence);
    events.push(
      createComplianceProofEvent({
        type: 'channel_eligibility_checked',
        prospectId: prospect.id,
        channel: 'email',
        decision: email.decision,
        summary: explainComplianceDecision(email),
        createdAt: prospect.updatedAt,
      }),
    );
    if (email.decision === 'human_review_required') {
      events.push(
        createComplianceProofEvent({
          type: 'human_review_required',
          prospectId: prospect.id,
          channel: 'email',
          decision: 'human_review_required',
          summary: `${prospect.companyName}: email outreach routed to human review.`,
          createdAt: prospect.updatedAt,
        }),
      );
    }
    events.push(
      createComplianceProofEvent({
        type: 'compliance_decision_logged',
        prospectId: prospect.id,
        channel: 'email',
        decision: email.decision,
        summary: `Decision logged for ${prospect.companyName} (email): ${email.decision}.`,
        createdAt: prospect.updatedAt,
      }),
    );
  }
  return events;
}

const DECISION_COLOR: Record<string, string> = {
  allowed: '#1a7f37',
  human_review_required: '#9a6700',
  blocked: '#cf222e',
};

export default function ComplianceProofPage() {
  const events = buildEvents();
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 24px' }}>
      <p style={{ fontSize: 13, color: '#57606a' }}>
        <a href="/portal/settings">← Settings</a>
      </p>
      <h1 style={{ fontSize: 24 }}>Compliance Proof</h1>
      <p style={{ color: '#57606a' }}>
        Proof events emitted by the compliance layer. Each compliance decision is logged for
        auditability — these support human review and do not replace legal review.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: '8px 6px' }}>Event</th>
            <th style={{ padding: '8px 6px' }}>Channel</th>
            <th style={{ padding: '8px 6px' }}>Decision</th>
            <th style={{ padding: '8px 6px' }}>Summary</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #eaeef2', verticalAlign: 'top' }}>
              <td style={{ padding: '8px 6px', fontWeight: 600 }}>{e.type}</td>
              <td style={{ padding: '8px 6px' }}>{e.channel ?? '—'}</td>
              <td
                style={{
                  padding: '8px 6px',
                  color: e.decision ? DECISION_COLOR[e.decision] : '#57606a',
                  fontWeight: 600,
                }}
              >
                {e.decision ?? '—'}
              </td>
              <td style={{ padding: '8px 6px', color: '#24292f' }}>{e.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
