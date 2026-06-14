'use client';

/**
 * V-4b — live public proof feed (`/trust/live`). Read-only researcher view of
 * the UNAUTHENTICATED `/public/trust-feed` endpoint, which returns ONLY
 * public-safe, redaction-passed proof projections + an aggregate reputation
 * summary from a server-configured public tenant (empty by default). No auth,
 * no token paste, no writes, no PII, no private proof bodies, no token surface.
 */

import { useCallback, useEffect, useState } from 'react';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface PublicProof {
  id: string;
  kind: string;
  evidence_tag: string;
  summary_public: string | null;
  supersedes_proof_id: string | null;
  created_at: string;
}
interface FeedResponse {
  configured: boolean;
  note?: string;
  proofs: PublicProof[];
  reputation: { agents_with_reputation: number; total_events: number; positive_events: number };
}

const muted = { color: '#57606a' } as const;

export default function TrustLivePage() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GET only; no credentials, no token, no body. Read-only.
      const res = await fetch(`${DEFAULT_API}/public/trust-feed`, { method: 'GET' });
      if (!res.ok) throw new Error(`feed error (${res.status})`);
      setFeed((await res.json()) as FeedResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the public feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 24, lineHeight: 1.55 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Cognitia — Live Public Proof Feed</h1>
      <p style={muted}>
        Read-only. This shows ONLY public-safe, redaction-passed proof projections and an aggregate
        reputation summary. No private proof bodies, no customer data, no token surface. See the{' '}
        <a href="/trust">Trust / Proof Explorer</a> for the full status overview.
      </p>

      <button onClick={() => void load()} disabled={loading} style={{ margin: '12px 0' }}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>

      {error ? (
        <p
          style={{
            background: '#ffebe9',
            border: '1px solid #cf222e',
            padding: 10,
            borderRadius: 6,
          }}
        >
          {error}
        </p>
      ) : null}

      {feed && !feed.configured ? (
        <p
          style={{
            background: '#fff8c5',
            border: '1px solid #d4a72c',
            padding: 10,
            borderRadius: 6,
          }}
        >
          No public tenant is configured, so nothing is published yet. This feed is intentionally
          empty by default.
        </p>
      ) : null}

      {feed ? (
        <>
          <section style={{ margin: '20px 0' }}>
            <h2 style={{ fontSize: 18 }}>Reputation (aggregate)</h2>
            <p style={muted}>Counts only — no agent identities, no per-agent scores.</p>
            <ul>
              <li>Agents with reputation: {feed.reputation.agents_with_reputation}</li>
              <li>Total reputation events: {feed.reputation.total_events}</li>
              <li>Positive events: {feed.reputation.positive_events}</li>
            </ul>
          </section>

          <section style={{ margin: '20px 0' }}>
            <h2 style={{ fontSize: 18 }}>Public-safe proofs ({feed.proofs.length})</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
                  <th style={{ padding: 6 }}>Proof</th>
                  <th style={{ padding: 6 }}>Kind</th>
                  <th style={{ padding: 6 }}>Evidence tag</th>
                  <th style={{ padding: 6 }}>Summary</th>
                  <th style={{ padding: 6 }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {feed.proofs.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #eaeef2' }}>
                    <td style={{ padding: 6 }}>
                      <code>{p.id.slice(0, 8)}…</code>
                    </td>
                    <td style={{ padding: 6 }}>{p.kind}</td>
                    <td style={{ padding: 6 }}>{p.evidence_tag}</td>
                    <td style={{ padding: 6 }}>{p.summary_public ?? '—'}</td>
                    <td style={{ padding: 6 }}>{p.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
                {feed.proofs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, ...muted }}>
                      No public-safe proofs published.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      <p style={{ ...muted, fontSize: 13, marginTop: 28 }}>
        Everything shown here passed a PII-redaction check before becoming public-safe. Private
        proof bodies, evidence/verifier references, customer data, and tenant identifiers are never
        served by this feed.
      </p>
    </main>
  );
}
