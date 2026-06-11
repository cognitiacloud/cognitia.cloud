'use client';

/**
 * COG-005 — SkillProof: the internal Certified Skills inventory (Core 20).
 * This is NOT a marketplace: internal visibility only, no prices, no listings.
 * Auth follows the console pattern (paste an operator session token).
 */

import { useCallback, useMemo, useState } from 'react';
import { ApiClient, ApiError, type SkillListView } from '../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TIER_LABELS = [
  'T0 registered',
  'T1 source-verified',
  'T2 proof-verified',
  'T3 (locked)',
  'T4 (locked)',
];

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401) — paste a valid token.';
    if (err.status === 403) return 'Insufficient permission (403).';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

export default function SkillsPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [skills, setSkills] = useState<SkillListView[]>([]);
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
      setSkills((await client.listSkills()).skills);
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const importCore = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const summary = await client.importCoreSkills();
      setNotice(
        `Core import: ${summary.imported} imported (${summary.with_real_source} with real source, ` +
          `${summary.seeded_without_source} seeded), ${summary.skipped_existing} already present.`,
      );
      setSkills((await client.listSkills()).skills);
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>SkillProof — Internal Skill Registry (Core 20)</h1>
      <p style={{ color: '#57606a' }}>
        Certified internal skills. Tier ≥ 2 requires a <code>verified_fact</code> proof; tiers 3–4
        are locked until real production/security evidence processes exist. Internal only — this is
        not a marketplace.
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
          Load skills
        </button>
        <button onClick={importCore} disabled={busy || !token}>
          Import Core 20
        </button>
      </section>

      {notice ? (
        <p style={{ padding: 8, background: '#fff8c5', border: '1px solid #d4a72c' }}>{notice}</p>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: 6 }}>Skill</th>
            <th style={{ padding: 6 }}>Namespace</th>
            <th style={{ padding: 6 }}>Category</th>
            <th style={{ padding: 6 }}>Proof tier</th>
            <th style={{ padding: 6 }}>Source</th>
            <th style={{ padding: 6 }}>Visibility</th>
            <th style={{ padding: 6 }}>Versions / proofs</th>
            <th style={{ padding: 6 }}>Yanked</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #d0d7de' }}>
              <td style={{ padding: 6 }}>{s.name}</td>
              <td style={{ padding: 6 }}>
                <code>{s.namespace}</code>
              </td>
              <td style={{ padding: 6 }}>{s.category}</td>
              <td style={{ padding: 6, fontWeight: 600 }}>
                {TIER_LABELS[s.top_proof_tier] ?? `T${s.top_proof_tier}`}
              </td>
              <td style={{ padding: 6 }}>
                {s.source_path ? <code>{s.source_path}</code> : <em>seeded</em>}
              </td>
              <td style={{ padding: 6 }}>{s.visibility}</td>
              <td style={{ padding: 6 }}>
                {s.version_count} / {s.proof_count}
              </td>
              <td style={{ padding: 6 }}>{s.yanked ? 'yes' : '—'}</td>
            </tr>
          ))}
          {skills.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 12, color: '#57606a' }}>
                No skills loaded. Use “Import Core 20” to seed the inventory.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
