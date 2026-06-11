'use client';

/**
 * COG-006 — MoverOS AI Front Desk + Lead Rescue (simulation-first).
 * Lead intake (or demo lead), masked lead table with lifecycle status,
 * action proposals (SMS drafts route through the approval console), simulated
 * sends, outcome recording, and the Lead Rescue summary. No raw PII renders
 * here — the list is masked; only verified_fact booked value is shown as
 * "verified". Real SMS does not exist in this build.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ApiClient,
  ApiError,
  type MaskedLeadView,
  type LeadRescueSummaryView,
} from '../../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const ACTIONS = [
  'propose_sms_reply',
  'qualify_lead',
  'request_missing_move_details',
  'estimate_urgency',
  'schedule_callback',
  'create_booking_intent',
  'handoff_to_human',
  'mark_rescued',
  'mark_unreachable',
];

const OUTCOMES = [
  'rescued_lead',
  'booking_intent',
  'booked_job',
  'lost_lead',
  'invalid_lead',
  'human_handoff',
  'unknown',
];

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401).';
    if (err.status === 403) return 'Forbidden (403) — real sends are disabled; check your role.';
    if (err.status === 409) return 'Refused (409) — approval required or lead purged.';
    if (err.status === 400)
      return 'Invalid (400) — verified_fact outcomes need an evidence source.';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

const dollars = (cents: number) => `$${(cents / 100).toLocaleString()}`;

export default function FrontDeskPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [leads, setLeads] = useState<MaskedLeadView[]>([]);
  const [summary, setSummary] = useState<LeadRescueSummaryView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedAction, setSelectedAction] = useState(ACTIONS[0]!);
  const [selectedOutcome, setSelectedOutcome] = useState(OUTCOMES[0]!);
  const [evidenceTag, setEvidenceTag] = useState<'verified_fact' | 'likely_inference' | 'unknown'>(
    'likely_inference',
  );
  const [evidenceSource, setEvidenceSource] = useState('');

  const client = useMemo(() => {
    const authedFetch: typeof fetch = (url, init) =>
      fetch(url, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), authorization: `Bearer ${token}` },
      });
    return new ApiClient({ baseUrl, tenantId: '', fetch: authedFetch });
  }, [baseUrl, token]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const [leadsRes, summaryRes] = await Promise.all([
        client.listLeads(),
        client.leadRescueSummary(),
      ]);
      setLeads(leadsRes.leads);
      setSummary(summaryRes);
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const createDemoLead = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      await client.ingestLead({
        source: 'sms_sim',
        contact_name: 'Demo Customer',
        contact_phone: `604555${String(Math.floor(1000 + Math.random() * 9000))}`,
        message_body: 'Hi, looking for a quote to move a 2-bedroom apartment next month.',
        consent_captured: true,
      });
      setNotice('Demo lead created (synthetic data, simulated SMS source).');
      await refresh();
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, refresh]);

  const propose = useCallback(
    async (leadId: string) => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await client.proposeLeadAction(leadId, selectedAction);
        setNotice(
          selectedAction === 'propose_sms_reply'
            ? 'SMS reply drafted (simulation) — approve it in the Approvals console, then execute the simulated send.'
            : `Action proposed (simulation). Proof: ${res.proof_id ?? 'created via SMS pipeline'}.`,
        );
        await refresh();
      } catch (err) {
        setNotice(explainError(err));
      } finally {
        setBusy(false);
      }
    },
    [client, selectedAction, refresh],
  );

  const recordOutcome = useCallback(
    async (leadId: string) => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await client.recordLeadOutcome(leadId, {
          outcome: selectedOutcome,
          evidence_tag: evidenceTag,
          evidence_source: evidenceSource || undefined,
        });
        setNotice(
          `Outcome recorded (${evidenceTag}); proof ${res.proof_id}. ` +
            (res.reputation_event_id
              ? 'Reputation credited (verified_fact).'
              : 'No reputation change (verified_fact required).'),
        );
        await refresh();
      } catch (err) {
        setNotice(explainError(err));
      } finally {
        setBusy(false);
      }
    },
    [client, selectedOutcome, evidenceTag, evidenceSource, refresh],
  );

  const purge = useCallback(
    async (leadId: string) => {
      if (!window.confirm('Purge this lead’s PII (PIPEDA)? This cannot be undone.')) return;
      setBusy(true);
      try {
        await client.purgeLeadPii(leadId);
        await refresh();
      } catch (err) {
        setNotice(explainError(err));
      } finally {
        setBusy(false);
      }
    },
    [client, refresh],
  );

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>MoverOS AI Front Desk — Lead Rescue</h1>
      <p style={{ color: '#57606a' }}>
        Simulation-first SMS lead rescue. Every agent action is approval-gated and proof-backed;
        real SMS does not exist in this build.{' '}
        <strong>Response SLA target: &lt; 60s (placeholder — measured per simulated send).</strong>
      </p>

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        <input
          style={{ flex: '1 1 220px', padding: 8 }}
          placeholder="API base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <input
          style={{ flex: '2 1 300px', padding: 8 }}
          placeholder="Operator session token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button onClick={refresh} disabled={busy || !token}>
          Load
        </button>
        <button onClick={createDemoLead} disabled={busy || !token}>
          Create demo lead
        </button>
      </section>

      {summary ? (
        <section
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            margin: '8px 0 16px',
            color: '#1f2328',
          }}
        >
          <span>
            Leads: <strong>{summary.total_leads}</strong>
          </span>
          <span>
            Need response: <strong>{summary.leads_needing_response}</strong>
          </span>
          <span>
            Actions: <strong>{summary.actions_proposed}</strong>
          </span>
          <span>
            Rescued: <strong>{summary.rescued_leads}</strong>
          </span>
          <span>
            Booking intents: <strong>{summary.booking_intents}</strong>
          </span>
          <span>
            Booked: <strong>{summary.booked_jobs}</strong>
          </span>
          <span>
            Estimated: <strong>{dollars(summary.estimated_value_cents)}</strong>
          </span>
          <span style={{ color: '#1a7f37' }}>
            Verified booked: <strong>{dollars(summary.verified_booked_value_cents)}</strong>
          </span>
          <span>
            Unknown outcomes: <strong>{summary.unknown_outcomes}</strong>
          </span>
        </section>
      ) : null}

      {notice ? (
        <p style={{ padding: 8, background: '#fff8c5', border: '1px solid #d4a72c' }}>{notice}</p>
      ) : null}

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
        <label>
          Action:{' '}
          <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
            {ACTIONS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Outcome:{' '}
          <select value={selectedOutcome} onChange={(e) => setSelectedOutcome(e.target.value)}>
            {OUTCOMES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          Evidence:{' '}
          <select
            value={evidenceTag}
            onChange={(e) => setEvidenceTag(e.target.value as typeof evidenceTag)}
          >
            <option>verified_fact</option>
            <option>likely_inference</option>
            <option>unknown</option>
          </select>
        </label>
        <input
          style={{ flex: '1 1 200px', padding: 4 }}
          placeholder="evidence source (required for verified_fact)"
          value={evidenceSource}
          onChange={(e) => setEvidenceSource(e.target.value)}
        />
      </section>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: 6 }}>Phone</th>
            <th style={{ padding: 6 }}>Source</th>
            <th style={{ padding: 6 }}>Status</th>
            <th style={{ padding: 6 }}>Received</th>
            <th style={{ padding: 6 }}>Badges</th>
            <th style={{ padding: 6 }} />
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #d0d7de' }}>
              <td style={{ padding: 6 }}>
                <code>{l.phone_masked}</code>
              </td>
              <td style={{ padding: 6 }}>{l.source}</td>
              <td style={{ padding: 6, fontWeight: 600 }}>{l.status}</td>
              <td style={{ padding: 6 }}>{new Date(l.received_at).toLocaleTimeString()}</td>
              <td style={{ padding: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: '#ddf4ff',
                    borderRadius: 10,
                    padding: '1px 8px',
                    fontSize: 12,
                  }}
                >
                  simulation
                </span>
                {l.status === 'human_review_required' ? (
                  <span
                    style={{
                      background: '#fff1e5',
                      borderRadius: 10,
                      padding: '1px 8px',
                      fontSize: 12,
                    }}
                  >
                    approval required
                  </span>
                ) : null}
                {l.pii_status === 'purged' ? (
                  <span
                    style={{
                      background: '#ffebe9',
                      borderRadius: 10,
                      padding: '1px 8px',
                      fontSize: 12,
                    }}
                  >
                    purged
                  </span>
                ) : null}
              </td>
              <td style={{ padding: 6, display: 'flex', gap: 6 }}>
                <button onClick={() => propose(l.id)} disabled={busy || l.pii_status === 'purged'}>
                  Propose action
                </button>
                <button onClick={() => recordOutcome(l.id)} disabled={busy}>
                  Record outcome
                </button>
                <button onClick={() => purge(l.id)} disabled={busy || l.pii_status === 'purged'}>
                  Purge PII
                </button>
              </td>
            </tr>
          ))}
          {leads.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 12, color: '#57606a' }}>
                No leads loaded. Create a demo lead to exercise the rescue loop.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
