'use client';

/**
 * COG-004 — Agent detail: ATC lifecycle (issue / suspend / resume / expire /
 * revoke) and the permission policy. Revoke is owner-only and terminal; the
 * UI mirrors that. Claims display scope/vertical/policy refs only — the
 * credential cannot carry customer PII (strict schema, API-enforced).
 */

import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ApiClient,
  ApiError,
  type AgentDetailView,
  type ReputationView,
} from '../../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401).';
    if (err.status === 403)
      return 'Forbidden (403) — revoke and sms.send_real → allow require the owner role.';
    if (err.status === 409) return 'Illegal transition (409) — check the credential status.';
    if (err.status === 404) return 'Not found (404).';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [detail, setDetail] = useState<AgentDetailView | null>(null);
  const [reputation, setReputation] = useState<ReputationView | null>(null);
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
      const [agent, rep] = await Promise.all([
        client.getAgent(agentId),
        client.getAgentReputation(agentId),
      ]);
      setDetail(agent);
      setReputation(rep);
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, agentId]);

  const recompute = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await client.recomputeReputation(agentId);
      setNotice(
        res.was_current
          ? 'Snapshot already current — nothing recomputed.'
          : `Snapshot appended: score ${res.snapshot.score}.`,
      );
      setReputation(await client.getAgentReputation(agentId));
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, agentId]);

  const issue = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      await client.issueAtc(agentId, { scope: ['lead.read', 'sms.draft'], vertical: 'moveros' });
      setDetail(await client.getAgent(agentId));
      setNotice('ATC issued (active).');
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, agentId]);

  const transition = useCallback(
    async (atcId: string, action: 'suspend' | 'resume' | 'expire' | 'revoke') => {
      if (action === 'revoke' && !window.confirm('Revocation is TERMINAL. Revoke this ATC?')) {
        return;
      }
      setBusy(true);
      setNotice(null);
      try {
        await client.atcTransition(atcId, action);
        setDetail(await client.getAgent(agentId));
        setNotice(`ATC ${action} applied.`);
      } catch (err) {
        setNotice(explainError(err));
      } finally {
        setBusy(false);
      }
    },
    [client, agentId],
  );

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <p>
        <Link href="/agents">← all agents</Link>
      </p>
      <h1>{detail ? detail.agent.name : 'Agent detail'}</h1>

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
        <button onClick={issue} disabled={busy || !token || !detail}>
          Issue ATC
        </button>
      </section>

      {notice ? (
        <p style={{ padding: 8, background: '#fff8c5', border: '1px solid #d4a72c' }}>{notice}</p>
      ) : null}

      {detail ? (
        <>
          <p style={{ color: '#57606a' }}>
            {detail.agent.kind} · {detail.agent.status} · slug <code>{detail.agent.slug}</code>
            {detail.agent.description ? <> — {detail.agent.description}</> : null}
          </p>

          <h2>Agent Trust Credentials</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
                <th style={{ padding: 6 }}>Status</th>
                <th style={{ padding: 6 }}>Issuer</th>
                <th style={{ padding: 6 }}>Claims (scope / vertical)</th>
                <th style={{ padding: 6 }}>Issued</th>
                <th style={{ padding: 6 }}>Lifecycle</th>
              </tr>
            </thead>
            <tbody>
              {detail.atcs.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                  <td style={{ padding: 6, fontWeight: 600 }}>{c.status}</td>
                  <td style={{ padding: 6 }}>{c.issuer}</td>
                  <td style={{ padding: 6 }}>
                    {(c.claims.scope ?? []).join(', ') || '—'}
                    {c.claims.vertical ? ` · ${c.claims.vertical}` : ''}
                  </td>
                  <td style={{ padding: 6 }}>{new Date(c.issued_at).toLocaleString()}</td>
                  <td style={{ padding: 6, display: 'flex', gap: 6 }}>
                    {c.status === 'active' ? (
                      <button onClick={() => transition(c.id, 'suspend')} disabled={busy}>
                        Suspend
                      </button>
                    ) : null}
                    {c.status === 'suspended' ? (
                      <button onClick={() => transition(c.id, 'resume')} disabled={busy}>
                        Resume
                      </button>
                    ) : null}
                    {c.status === 'active' || c.status === 'suspended' ? (
                      <>
                        <button onClick={() => transition(c.id, 'expire')} disabled={busy}>
                          Expire
                        </button>
                        <button
                          onClick={() => transition(c.id, 'revoke')}
                          disabled={busy}
                          style={{ color: '#cf222e' }}
                        >
                          Revoke (owner)
                        </button>
                      </>
                    ) : null}
                    {c.status === 'revoked' ? <em style={{ color: '#cf222e' }}>terminal</em> : null}
                  </td>
                </tr>
              ))}
              {detail.atcs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: '#57606a' }}>
                    No credential issued yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <h2>Reputation (verified facts only)</h2>
          {reputation ? (
            <section style={{ marginBottom: 16 }}>
              <p>
                Score: <strong style={{ fontSize: 18 }}>{reputation.score}</strong> from{' '}
                {reputation.event_count} proof-backed event{reputation.event_count === 1 ? '' : 's'}
                {' · '}snapshot {reputation.snapshot_current ? 'current' : 'stale'}{' '}
                <button onClick={recompute} disabled={busy}>
                  Recompute snapshot
                </button>
              </p>
              {reputation.events.length > 0 ? (
                <ul style={{ color: '#57606a' }}>
                  {reputation.events.slice(0, 10).map((e) => (
                    <li key={e.id}>
                      {e.delta > 0 ? `+${e.delta}` : e.delta} — {e.reason_code} ·{' '}
                      {new Date(e.created_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#57606a' }}>
                  No reputation yet — only verified_fact outcomes can add it.
                </p>
              )}
            </section>
          ) : null}

          <h2>Permissions</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
                <th style={{ padding: 6 }}>Action</th>
                <th style={{ padding: 6 }}>Effect</th>
                <th style={{ padding: 6 }}>Constraints</th>
              </tr>
            </thead>
            <tbody>
              {detail.permissions.map((p) => (
                <tr key={p.action_key} style={{ borderBottom: '1px solid #d0d7de' }}>
                  <td style={{ padding: 6 }}>
                    <code>{p.action_key}</code>
                  </td>
                  <td
                    style={{
                      padding: 6,
                      color: p.effect === 'deny' ? '#cf222e' : '#1a7f37',
                      fontWeight: 600,
                    }}
                  >
                    {p.effect}
                  </td>
                  <td style={{ padding: 6 }}>
                    <code>{JSON.stringify(p.constraints)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: '#57606a' }}>
            Doctrine: <code>sms.send_real</code> is deny-by-default; only the owner role may flip it
            to allow, and execution still requires human approval.
          </p>
        </>
      ) : (
        <p style={{ color: '#57606a' }}>Paste a token and load to view this agent.</p>
      )}
    </main>
  );
}
