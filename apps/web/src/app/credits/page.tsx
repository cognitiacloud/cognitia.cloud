'use client';

/**
 * COG-009 — Internal Credits console (Lane C). INTERNAL ACCOUNTING ONLY:
 * credits are bookkeeping units, not a currency or token. There is no
 * purchase path, no pricing, no staking, no chain activity — wallet rows are
 * inert placeholders. Doctrine: ARCHITECTURE_LOCK_V1_1.md §5.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ApiClient,
  ApiError,
  type CreditsAccountView,
  type WalletBindingView,
} from '../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401).';
    if (err.status === 403) return 'Insufficient permission (403).';
    if (err.status === 409) return 'Refused (409) — placeholder/rail/account-state rule.';
    if (err.status === 422)
      return 'Insufficient credits (422) — only system accounts may go negative.';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

export default function CreditsPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [accounts, setAccounts] = useState<CreditsAccountView[]>([]);
  const [bindings, setBindings] = useState<WalletBindingView[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('100');

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
      const [a, w] = await Promise.all([client.listCreditsAccounts(), client.listWalletBindings()]);
      setAccounts(a.accounts);
      setBindings(w.bindings);
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const doTransfer = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await client.transferCredits({
        from_account_id: fromId,
        to_account_id: toId,
        amount: Number(amount),
        reason_code: 'operator_grant',
        idempotency_key: `console-${Date.now()}`,
      });
      setNotice(
        res.replayed
          ? 'Replay detected — ledger unchanged (idempotent).'
          : `Transferred ${res.amount} credits. Balances: from ${res.from_balance}, to ${res.to_balance}.`,
      );
      await refresh();
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, fromId, toId, amount, refresh]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Internal Credits</h1>
      <p style={{ color: '#57606a' }}>
        Append-only double-entry accounting for internal agent work. Credits are bookkeeping units,
        not a currency or token; wallet rows below are inert placeholders with no keys and no chain
        activity.
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

      <h2>Accounts</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: 6 }}>Account</th>
            <th style={{ padding: 6 }}>Owner</th>
            <th style={{ padding: 6 }}>Status</th>
            <th style={{ padding: 6 }}>Balance (credits)</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #d0d7de' }}>
              <td style={{ padding: 6 }}>
                <code>{a.id.slice(0, 8)}…</code>
              </td>
              <td style={{ padding: 6 }}>{a.owner_type}</td>
              <td style={{ padding: 6 }}>{a.status}</td>
              <td style={{ padding: 6, fontWeight: 600 }}>{a.balance}</td>
            </tr>
          ))}
          {accounts.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 12, color: '#57606a' }}>
                No accounts loaded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2>Transfer (internal grant)</h2>
      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }}>
        <input
          style={{ flex: '2 1 260px', padding: 8 }}
          placeholder="from account id"
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
        />
        <input
          style={{ flex: '2 1 260px', padding: 8 }}
          placeholder="to account id"
          value={toId}
          onChange={(e) => setToId(e.target.value)}
        />
        <input
          style={{ flex: '1 1 100px', padding: 8 }}
          placeholder="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button onClick={doTransfer} disabled={busy || !token || !fromId || !toId}>
          Transfer
        </button>
      </section>

      <h2>Wallet placeholders (inert)</h2>
      <ul style={{ color: '#57606a' }}>
        {bindings.map((b) => (
          <li key={b.id}>
            {b.owner_type} · chain <code>{b.chain}</code> · status <code>{b.status}</code> — no
            keys, no activity
          </li>
        ))}
        {bindings.length === 0 ? <li>No wallet placeholders.</li> : null}
      </ul>
    </main>
  );
}
