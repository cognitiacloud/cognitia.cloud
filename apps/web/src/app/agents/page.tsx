'use client';

/**
 * COG-004 — Agents console: registry list with ATC status badges.
 * Public product language: Cognitia Agent Trust Credential (ATC).
 * Auth follows the approvals console (paste an operator session token).
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiClient, ApiError, type AgentView } from '../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const ATC_COLORS: Record<string, string> = {
  active: '#1a7f37',
  suspended: '#9a6700',
  revoked: '#cf222e',
  expired: '#57606a',
  none: '#8c959f',
};

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401) — paste a valid token.';
    if (err.status === 403) return 'Insufficient permission (403).';
    if (err.status === 409) return 'Conflict (409) — duplicate slug?';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

export default function AgentsPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');

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
      setAgents((await client.listAgents()).agents);
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const register = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      await client.registerAgent({ name: newName, slug: newSlug, kind: 'front_desk' });
      setNewName('');
      setNewSlug('');
      setAgents((await client.listAgents()).agents);
      setNotice('Agent registered with sms.send_real → deny (doctrine default).');
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, newName, newSlug]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Agents</h1>
      <p style={{ color: '#57606a' }}>
        Cognitia-operated agents and their Agent Trust Credential (ATC) status. Real SMS is
        deny-by-default for every agent.
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
          Load agents
        </button>
      </section>

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }}>
        <input
          style={{ flex: '1 1 200px', padding: 8 }}
          placeholder="New agent name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          style={{ flex: '1 1 200px', padding: 8 }}
          placeholder="slug (kebab-case)"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
        />
        <button onClick={register} disabled={busy || !token || !newName || !newSlug}>
          Register agent
        </button>
      </section>

      {notice ? (
        <p style={{ padding: 8, background: '#fff8c5', border: '1px solid #d4a72c' }}>{notice}</p>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: 6 }}>Name</th>
            <th style={{ padding: 6 }}>Kind</th>
            <th style={{ padding: 6 }}>Agent status</th>
            <th style={{ padding: 6 }}>ATC</th>
            <th style={{ padding: 6 }} />
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #d0d7de' }}>
              <td style={{ padding: 6 }}>
                {a.name} <span style={{ color: '#8c959f' }}>({a.slug})</span>
              </td>
              <td style={{ padding: 6 }}>{a.kind}</td>
              <td style={{ padding: 6 }}>{a.status}</td>
              <td style={{ padding: 6 }}>
                <span
                  style={{
                    color: '#fff',
                    background: ATC_COLORS[a.atc_status] ?? '#8c959f',
                    borderRadius: 12,
                    padding: '2px 10px',
                    fontSize: 13,
                  }}
                >
                  {a.atc_status}
                </span>
                {a.atc_count > 1 ? (
                  <span style={{ color: '#8c959f', marginLeft: 6 }}>({a.atc_count} issued)</span>
                ) : null}
              </td>
              <td style={{ padding: 6 }}>
                <Link href={`/agents/${a.id}`}>detail →</Link>
              </td>
            </tr>
          ))}
          {agents.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 12, color: '#57606a' }}>
                No agents loaded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
