import { getDefaultChannelPolicy } from '../../../lib/compliance';
import type { ChannelStatus } from '../../../lib/complianceTypes';

/**
 * Portal → Settings → Compliance & Channels.
 *
 * Governance surface for the Sales Closer compliance layer. Read-only, demo-safe:
 * it renders the default channel policy and required evidence posture. No sending,
 * no persistence, no external calls.
 */

export const metadata = { title: 'Compliance & Channels — Sales Closer' };

const STATUS_COPY: Record<ChannelStatus, { label: string; color: string }> = {
  enabled: { label: 'Enabled (human review)', color: '#1a7f37' },
  human_review_required: { label: 'Human review required', color: '#9a6700' },
  gated_off: { label: 'Gated off', color: '#57606a' },
  blocked: { label: 'Blocked', color: '#cf222e' },
};

const CHANNEL_NOTES: Record<string, string> = {
  email:
    'Requires consent/contact-basis tracking, sender identification, working unsubscribe, and evidence logs.',
  phone:
    'Requires National DNCL + internal DNC checks, caller identification, and calling-hours compliance.',
  sms: 'Gated off by default until explicitly approved (CASL CEM).',
  whatsapp: 'Gated off by default until explicitly approved (CASL CEM + WhatsApp Business policy).',
  ai_voice:
    'Gated off by default until explicitly approved (CRTC ADAD + AI-voice disclosure + legal review).',
  linkedin: 'Manual / human-review only — no automation.',
  manual_task: 'Human task; no automated messaging.',
};

export default function SettingsPage() {
  const policy = getDefaultChannelPolicy();
  const channels = Object.entries(policy.channels) as [string, ChannelStatus][];

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <p style={{ fontSize: 13, color: '#57606a' }}>
        <a href="/portal/settings/data-sources">Data sources →</a> &nbsp;·&nbsp;{' '}
        <a href="/portal/agent-economy">Agent boundaries →</a> &nbsp;·&nbsp;{' '}
        <a href="/portal/proof">Compliance proof →</a> &nbsp;·&nbsp;{' '}
        <a href="/discovery">Discovery →</a>
      </p>
      <h1 style={{ fontSize: 24 }}>Compliance &amp; Channels</h1>
      <p style={{ color: '#57606a' }}>
        Compliance checks support human review and auditability. They do not replace legal review.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Channel policy</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: '8px 6px' }}>Channel</th>
            <th style={{ padding: '8px 6px' }}>Status</th>
            <th style={{ padding: '8px 6px' }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {channels.map(([channel, status]) => {
            const c = STATUS_COPY[status];
            return (
              <tr key={channel} style={{ borderBottom: '1px solid #eaeef2' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>{channel}</td>
                <td style={{ padding: '8px 6px', color: c.color, fontWeight: 600 }}>{c.label}</td>
                <td style={{ padding: '8px 6px', color: '#57606a' }}>{CHANNEL_NOTES[channel]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Suppression &amp; checks</h2>
      <ul style={{ color: '#24292f', lineHeight: 1.7 }}>
        <li>
          Unsubscribe, internal DNC, National DNCL, and do-not-contact flags block outreach on all
          channels.
        </li>
        <li>
          Email requires a working unsubscribe mechanism:{' '}
          {String(policy.requireUnsubscribeForEmail)}.
        </li>
        <li>Phone requires DNC/DNCL checks: {String(policy.requireDncChecksForPhone)}.</li>
        <li>
          AI-generated drafts require human approval before sending:{' '}
          {String(policy.aiDraftsRequireHumanApproval)}.
        </li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Required evidence fields</h2>
      <p style={{ color: '#57606a' }}>
        A prospect cannot leave manual review without: {policy.requiredEvidenceFields.join(', ')}{' '}
        (plus a role-relevance note, and a screenshot or content hash where available).
      </p>

      <p style={{ marginTop: 24, fontSize: 12, color: '#8c959f' }}>
        SMS, WhatsApp, and AI voice are gated off by default until explicitly approved. AI can draft
        outreach, but human approval is required before sending.
      </p>
    </main>
  );
}
