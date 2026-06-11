'use client';

/**
 * COG-003 — Proof Registry console (operator surface).
 *
 * Shows proofs with their evidence tags, lets the operator run the PII
 * redaction check, and previews the public-safe projection. Private fields
 * (details_private, evidence/verifier refs) stay on the operator view; the
 * public preview renders ONLY what `/proofs/public` returns.
 *
 * Auth follows the approvals console: paste a signed operator session token;
 * the API derives tenant + role from it.
 */

import { useCallback, useMemo, useState } from 'react';
import { ApiClient, ApiError, type ProofView, type PublicProofView } from '../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TAGS = ['all', 'verified_fact', 'likely_inference', 'unknown'] as const;

const TAG_COLORS: Record<string, string> = {
  verified_fact: '#1a7f37',
  likely_inference: '#9a6700',
  unknown: '#57606a',
};

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401) — paste a valid token.';
    if (err.status === 403) return 'Insufficient permission (403) — requires operator or owner.';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

export default function ProofsPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [tag, setTag] = useState<(typeof TAGS)[number]>('all');
  const [proofs, setProofs] = useState<ProofView[]>([]);
  const [publicPreview, setPublicPreview] = useState<PublicProofView[] | null>(null);
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
      const res = await client.listProofs(tag === 'all' ? undefined : tag);
      setProofs(res.proofs);
      if (publicPreview !== null) {
        setPublicPreview((await client.listPublicProofs()).proofs);
      }
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, tag, publicPreview]);

  const runRedactionCheck = useCallback(
    async (id: string) => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await client.proofRedactionCheck(id);
        setNotice(
          res.publish_safe
            ? 'Redaction check passed — proof is public-safe.'
            : `Blocked from publishing — findings: ${res.findings.join(', ')}`,
        );
        setProofs((prev) => prev.map((p) => (p.id === id ? res.proof : p)));
      } catch (err) {
        setNotice(explainError(err));
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  const togglePublicPreview = useCallback(async () => {
    if (publicPreview !== null) {
      setPublicPreview(null);
      return;
    }
    setBusy(true);
    try {
      setPublicPreview((await client.listPublicProofs()).proofs);
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, publicPreview]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Proof Registry</h1>
      <p style={{ color: '#57606a' }}>
        Append-only evidence records. Only <code>verified_fact</code> proofs count toward
        reputation; nothing is public without a passed redaction check.
      </p>

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        <input
          style={{ flex: '1 1 240px', padding: 8 }}
          placeholder="API base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <input
          style={{ flex: '2 1 320px', padding: 8 }}
          placeholder="Operator session token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <select value={tag} onChange={(e) => setTag(e.target.value as (typeof TAGS)[number])}>
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button onClick={refresh} disabled={busy || !token}>
          Load proofs
        </button>
        <button onClick={togglePublicPreview} disabled={busy || !token}>
          {publicPreview === null ? 'Preview public view' : 'Hide public view'}
        </button>
      </section>

      {notice ? (
        <p style={{ padding: 8, background: '#fff8c5', border: '1px solid #d4a72c' }}>{notice}</p>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: 6 }}>Kind</th>
            <th style={{ padding: 6 }}>Evidence tag</th>
            <th style={{ padding: 6 }}>Summary (public field)</th>
            <th style={{ padding: 6 }}>Public-safe</th>
            <th style={{ padding: 6 }}>Created</th>
            <th style={{ padding: 6 }} />
          </tr>
        </thead>
        <tbody>
          {proofs.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #d0d7de' }}>
              <td style={{ padding: 6 }}>
                {p.kind}
                {p.supersedes_proof_id ? ' (supersedes)' : ''}
              </td>
              <td style={{ padding: 6 }}>
                <span style={{ color: TAG_COLORS[p.evidence_tag] ?? '#57606a', fontWeight: 600 }}>
                  {p.evidence_tag}
                </span>
              </td>
              <td style={{ padding: 6 }}>{p.summary_public ?? '—'}</td>
              <td style={{ padding: 6 }}>{p.public_safe ? '✓ public' : 'private'}</td>
              <td style={{ padding: 6 }}>{new Date(p.created_at).toLocaleString()}</td>
              <td style={{ padding: 6 }}>
                <button onClick={() => runRedactionCheck(p.id)} disabled={busy}>
                  Run redaction check
                </button>
              </td>
            </tr>
          ))}
          {proofs.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 12, color: '#57606a' }}>
                No proofs loaded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {publicPreview !== null ? (
        <section style={{ marginTop: 24 }}>
          <h2>Public view (what a non-operator surface would see)</h2>
          <ul>
            {publicPreview.map((p) => (
              <li key={p.id}>
                <strong>{p.evidence_tag}</strong> · {p.kind} · {p.summary_public ?? '—'} ·{' '}
                {new Date(p.created_at).toLocaleDateString()}
              </li>
            ))}
            {publicPreview.length === 0 ? <li>No public-safe proofs yet.</li> : null}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
