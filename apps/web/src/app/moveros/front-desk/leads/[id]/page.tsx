'use client';

/**
 * COG-011 (UI) — Lead detail console (operator/owner only).
 *
 * The aggregate endpoint `GET /leads/:id` already exists and is operator-gated;
 * only the console page was deferred (see commandSummary.ts: "API exists
 * (GET /leads/:id); console page deferred"). This page closes that gap: it
 * renders the decrypted lead story on a need-to-know basis and offers the same
 * proof-backed, approval-gated controls as the masked list — propose action,
 * record outcome (verified_fact needs an evidence source), draft the AI reply
 * into the approval queue, and PIPEDA purge. No raw PII renders on the list;
 * decryption happens only here, behind the operator gate (viewer → 403).
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ApiClient, ApiError, type LeadDetailView } from '../../../../../lib/apiClient';

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
    if (err.status === 403) return 'Forbidden (403) — decrypted detail is operator/owner only.';
    if (err.status === 404) return 'Lead not found (404) for this tenant.';
    if (err.status === 409) return 'Refused (409) — approval required or lead purged.';
    if (err.status === 400)
      return 'Invalid (400) — verified_fact outcomes need an evidence source.';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params?.id ?? '';

  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [detail, setDetail] = useState<LeadDetailView | null>(null);
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
      setDetail(await client.getLead(leadId));
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, leadId]);

  const propose = useCallback(async () => {
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
  }, [client, leadId, selectedAction, refresh]);

  const recordOutcome = useCallback(async () => {
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
  }, [client, leadId, selectedOutcome, evidenceTag, evidenceSource, refresh]);

  const purge = useCallback(async () => {
    if (!window.confirm('Purge this lead’s PII (PIPEDA)? This cannot be undone.')) return;
    setBusy(true);
    setNotice(null);
    try {
      await client.purgeLeadPii(leadId);
      setNotice('PII purged (PIPEDA). Decrypted fields are now blanked.');
      await refresh();
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, leadId, refresh]);

  const lead = detail?.lead ?? null;
  const purged = lead?.pii_status === 'purged';

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/moveros/front-desk">← Back to Lead Rescue</Link>
      </p>
      <h1>Lead detail</h1>
      <p style={{ color: '#57606a' }}>
        Decrypted contact data on a need-to-know basis (operator/owner only). The masked list never
        shows raw PII; this view does, behind the role gate. Lead <code>{leadId}</code>.
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
      </section>

      {notice ? (
        <p style={{ padding: 8, background: '#fff8c5', border: '1px solid #d4a72c' }}>{notice}</p>
      ) : null}

      {lead ? (
        <>
          <section style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 16px' }}>
            <span
              style={{ background: '#ddf4ff', borderRadius: 10, padding: '1px 8px', fontSize: 12 }}
            >
              simulation
            </span>
            <span
              style={{ background: '#eaeef2', borderRadius: 10, padding: '1px 8px', fontSize: 12 }}
            >
              {lead.status}
            </span>
            {lead.status === 'human_review_required' ? (
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
            {purged ? (
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
          </section>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              {(
                [
                  ['Contact name', purged ? '— (purged)' : (lead.contact_name ?? '—')],
                  ['Phone (masked)', lead.phone_masked],
                  ['Source', lead.source],
                  ['Consent captured', lead.consent_captured ? 'yes' : 'no'],
                  ['PII status', lead.pii_status],
                  ['Received', new Date(lead.received_at).toLocaleString()],
                ] as Array<[string, string]>
              ).map(([k, v]) => (
                <tr key={k} style={{ borderBottom: '1px solid #d0d7de' }}>
                  <th style={{ textAlign: 'left', padding: 6, width: 180, color: '#57606a' }}>
                    {k}
                  </th>
                  <td style={{ padding: 6 }}>{v}</td>
                </tr>
              ))}
              <tr>
                <th
                  style={{ textAlign: 'left', padding: 6, color: '#57606a', verticalAlign: 'top' }}
                >
                  Message
                </th>
                <td style={{ padding: 6, whiteSpace: 'pre-wrap' }}>
                  {purged ? '— (purged)' : (lead.message_body ?? '—')}
                </td>
              </tr>
            </tbody>
          </table>

          <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label>
              Action:{' '}
              <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
                {ACTIONS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <button onClick={propose} disabled={busy || purged}>
              Propose action
            </button>
          </section>

          <section
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
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
            <button onClick={recordOutcome} disabled={busy}>
              Record outcome
            </button>
          </section>

          <section style={{ marginTop: 16 }}>
            <button onClick={purge} disabled={busy || purged}>
              Purge PII
            </button>
          </section>
        </>
      ) : (
        <p style={{ color: '#57606a' }}>
          Enter an operator token and Load to view this lead’s decrypted detail.
        </p>
      )}
    </main>
  );
}
