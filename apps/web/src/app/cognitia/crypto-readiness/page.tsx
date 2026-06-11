'use client';

/**
 * COG-009 — INTERNAL crypto-readiness console (Lane C, operator-only).
 * This page is a status board, not marketing: it exists to show what is
 * deliberately DISABLED and legal-gated. Doctrine: ARCHITECTURE_LOCK_V1_1.md
 * §5 and docs/cognitia/internal/CRYPTO_READINESS.md.
 */

import { useCallback, useMemo, useState } from 'react';
import { ApiClient, ApiError, type CryptoReadinessView } from '../../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401).';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

const Row = ({ label, value, ok }: { label: string; value: string; ok?: boolean }) => (
  <tr style={{ borderBottom: '1px solid #d0d7de' }}>
    <td style={{ padding: 6 }}>{label}</td>
    <td style={{ padding: 6, fontWeight: 600, color: ok === false ? '#cf222e' : '#1f2328' }}>
      {value}
    </td>
  </tr>
);

export default function CryptoReadinessPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [view, setView] = useState<CryptoReadinessView | null>(null);
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
      setView(await client.cryptoReadiness());
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Crypto Readiness — Internal Status Board</h1>
      <p
        style={{
          padding: 10,
          background: '#fff8c5',
          border: '1px solid #d4a72c',
          fontWeight: 600,
        }}
      >
        INTERNAL — LEGAL-GATED. Cognitia&rsquo;s crypto layer is designed-for-later. Current
        implementation supports internal credits, accounting primitives, and wallet binding
        placeholders only. Any public token, liquidity, staking, exchange, or payment execution
        requires legal review, real usage gates, and founder approval.
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
          Load status
        </button>
      </section>

      {notice ? (
        <p style={{ padding: 8, background: '#ffebe9', border: '1px solid #cf222e' }}>{notice}</p>
      ) : null}

      {view ? (
        <>
          <h2>Current internal primitives</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Row label="Credits accounts" value={String(view.credits_accounts)} />
              <Row label="Ledger entries (append-only)" value={String(view.ledger_entries)} />
              <Row label="Wallet binding placeholders" value={String(view.wallet_bindings)} />
            </tbody>
          </table>

          <h2>Gates and disabled surfaces</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Row label="Public token status" value={view.token_public_status} ok={false} />
              <Row label="Legal gate" value={view.legal_gate} ok={false} />
              <Row label="Real payment execution" value={view.real_payment_execution} ok={false} />
              <Row label="Base/EVM optionality" value={view.base_evm_optionality} />
              <Row
                label="Future integration references"
                value={view.future_integration_refs.join(', ')}
              />
              <Row label="DEX or pool listing plan" value={view.dex_or_liquidity_plan} />
              <Row label="Staking or reward programs" value={view.staking_or_reward_programs} />
              <Row
                label="Public token launch readiness"
                value={view.public_token_launch_readiness}
              />
            </tbody>
          </table>

          <h2>Conceptual rails (design references only)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {view.conceptual_rails.map((r) => (
                <Row key={r.rail} label={r.rail} value={r.status} />
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p style={{ color: '#57606a' }}>Paste a token and load to view the internal status.</p>
      )}
    </main>
  );
}
