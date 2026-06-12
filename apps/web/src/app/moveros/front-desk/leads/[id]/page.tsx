'use client';

/**
 * COG-011 — Lead detail (operator-only). The lead's full story in one view:
 * decrypted contact + message (operators are authorized; viewers are 403'd
 * by the API), agent actions with drafts and simulation badges, evidence-
 * tagged outcomes, every related proof, and audit refs. Raw PII never leaves
 * this operator surface; the list view stays masked.
 */

import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ApiClient, ApiError, type LeadDetailView } from '../../../../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TAG_COLORS: Record<string, string> = {
  verified_fact: '#1a7f37',
  likely_inference: '#9a6700',
  unknown: '#57606a',
};

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401).';
    if (err.status === 403)
      return 'Operator or owner role required (403) — viewers see masked lists only.';
    if (err.status === 404) return 'Lead not found (404).';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

const dollars = (cents: number | null) =>
  cents === null ? '—' : `$${(cents / 100).toLocaleString()}`;

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [detail, setDetail] = useState<LeadDetailView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const executeSend = useCallback(
    async (actionId: string) => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await client.executeFrontDeskAction(actionId);
        setNotice(
          `Simulated send executed (${Math.round(res.response_time_ms / 1000)}s response time). ` +
            'Now send the approved text manually from the business phone.',
        );
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
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <p>
        <Link href="/moveros/front-desk">← all leads</Link>
      </p>
      <h1>Lead detail</h1>

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

      {detail ? (
        <>
          <section
            style={{ border: '1px solid #d0d7de', borderRadius: 8, padding: 12, marginBottom: 16 }}
          >
            <p style={{ margin: '2px 0' }}>
              <strong>{detail.lead.contact_name ?? 'Name purged/unknown'}</strong> ·{' '}
              <code>{detail.lead.phone_masked}</code> · {detail.lead.source} · status{' '}
              <strong>{detail.lead.status}</strong>
              {detail.lead.pii_status === 'purged' ? (
                <span style={{ color: '#cf222e' }}> · PII PURGED</span>
              ) : null}
            </p>
            <p style={{ margin: '6px 0 2px', color: '#1f2328' }}>
              {detail.lead.message_body ?? '(message purged)'}
            </p>
            <p style={{ margin: '4px 0 0', color: '#57606a', fontSize: 13 }}>
              received {new Date(detail.lead.received_at).toLocaleString()} · consent:{' '}
              {detail.lead.consent_captured ? 'yes' : 'NO — confirm before contact'}
            </p>
          </section>

          <h2>Actions</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              {detail.actions.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                  <td style={{ padding: 6 }}>
                    <code>{a.action_type}</code>
                  </td>
                  <td style={{ padding: 6 }}>
                    {a.approval_status} / {a.execution_status}
                  </td>
                  <td style={{ padding: 6 }}>
                    <span
                      style={{
                        background: '#ddf4ff',
                        borderRadius: 10,
                        padding: '1px 8px',
                        fontSize: 12,
                      }}
                    >
                      {a.simulation === false ? 'REAL (never in v1.1)' : 'simulation'}
                    </span>
                  </td>
                  <td style={{ padding: 6, color: '#57606a' }}>
                    {a.draft ? `"${a.draft.body.slice(0, 80)}…"` : '—'}
                  </td>
                  <td style={{ padding: 6 }}>
                    {a.approval_status === 'approved' && a.execution_status === 'pending' ? (
                      <button onClick={() => executeSend(a.id)} disabled={busy}>
                        Execute simulated send
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {detail.actions.length === 0 ? (
                <tr>
                  <td style={{ padding: 8, color: '#57606a' }}>No actions yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <h2>Outcomes</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              {detail.outcomes.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                  <td style={{ padding: 6, fontWeight: 600 }}>{o.outcome}</td>
                  <td style={{ padding: 6, color: TAG_COLORS[o.evidence_tag] }}>
                    {o.evidence_tag}
                  </td>
                  <td style={{ padding: 6 }}>
                    {o.evidence_source ? <code>{o.evidence_source}</code> : 'no evidence ref'}
                  </td>
                  <td style={{ padding: 6 }}>booked {dollars(o.booking_value_cents)}</td>
                  <td style={{ padding: 6, color: '#57606a' }}>
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {detail.outcomes.length === 0 ? (
                <tr>
                  <td style={{ padding: 8, color: '#57606a' }}>No outcomes recorded.</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <h2>Proofs</h2>
          <ul>
            {detail.proofs.map((p) => (
              <li key={p.id} style={{ marginBottom: 4 }}>
                <strong style={{ color: TAG_COLORS[p.evidence_tag] }}>{p.evidence_tag}</strong> ·{' '}
                {p.kind} · {p.summary_public ?? '—'}{' '}
                <span style={{ color: '#57606a' }}>
                  ({p.public_safe ? 'public-safe' : 'private'})
                </span>
              </li>
            ))}
            {detail.proofs.length === 0 ? <li>No proofs yet.</li> : null}
          </ul>

          <h2>Reputation impact</h2>
          <ul>
            {detail.reputation_links.map((r, i) => (
              <li key={i}>
                <Link href={`/agents/${r.agent_id}`}>
                  <code>{r.agent_id.slice(0, 8)}…</code>
                </Link>{' '}
                {r.delta > 0 ? `+${r.delta}` : r.delta} — {r.reason_code}
              </li>
            ))}
            {detail.reputation_links.length === 0 ? (
              <li style={{ color: '#57606a' }}>
                No reputation movement — only verified_fact outcomes create it.
              </li>
            ) : null}
          </ul>

          <h2>Audit trail refs</h2>
          <ul style={{ color: '#57606a', fontSize: 13 }}>
            {detail.audit_refs.map((a, i) => (
              <li key={i}>
                <code>{a.action}</code> on <code>{a.subject_ref}</code> ·{' '}
                {new Date(a.occurred_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p style={{ color: '#57606a' }}>Paste a token and load this lead.</p>
      )}
    </main>
  );
}
