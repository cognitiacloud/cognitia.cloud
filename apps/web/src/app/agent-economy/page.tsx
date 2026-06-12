'use client';

/**
 * AGENT-ECONOMY-001 — Agent Economy Lab console (internal operators only).
 * Escrow Simulation on internal credits: agent work orders, simulated skill
 * executions, proof-backed completion, reputation impact. The public-token
 * posture is locked (disabled / legal gate not passed) and this page repeats
 * it. No real payments, no token transfers, no chain activity.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ApiClient,
  ApiError,
  type EconomySummaryView,
  type WorkOrderView,
} from '../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401).';
    if (err.status === 403)
      return 'Insufficient permission (403) — verification is owner-only; acceptance needs an active ATC.';
    if (err.status === 409)
      return 'Refused (409) — transition/proof rule: escrow releases only on a verified_fact proof.';
    if (err.status === 422) return 'Insufficient credits (422) — escrow could not be reserved.';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

export default function AgentEconomyPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [summary, setSummary] = useState<EconomySummaryView | null>(null);
  const [orders, setOrders] = useState<WorkOrderView[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requesterId, setRequesterId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [title, setTitle] = useState('Produce an evidence-tagged brief');
  const [skillVersionId, setSkillVersionId] = useState('');
  const [credits, setCredits] = useState('100');

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
      const [s, o] = await Promise.all([client.economySummary(), client.listWorkOrders()]);
      setSummary(s);
      setOrders(o.work_orders);
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, done: string) => {
      setBusy(true);
      setNotice(null);
      try {
        await fn();
        setNotice(done);
        await refresh();
      } catch (err) {
        setNotice(explainError(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Agent Economy Lab</h1>
      <p style={{ color: '#57606a' }}>
        Internal Escrow Simulation: agent work orders settled in internal credits, delivered as
        simulated SkillProof executions, completed only against Proof Registry entries. Escrow
        releases — and reputation moves — only on <code>verified_fact</code>.
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
          <div
            style={{ border: '1px solid #d0d7de', borderRadius: 6, padding: 12, flex: '1 1 200px' }}
          >
            <strong>Work orders</strong>
            <div>{summary.work_orders.total} total</div>
            <div style={{ color: '#57606a', fontSize: 13 }}>
              {Object.entries(summary.work_orders.by_status)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ') || '—'}
            </div>
          </div>
          <div
            style={{ border: '1px solid #d0d7de', borderRadius: 6, padding: 12, flex: '1 1 240px' }}
          >
            <strong>Escrow (rail: {summary.escrow.rail})</strong>
            <div>reserved {summary.escrow.reserved_credits} cr</div>
            <div>released {summary.escrow.released_credits} cr</div>
            <div>
              refunded {summary.escrow.refunded_credits} cr · disputed{' '}
              {summary.escrow.disputed_credits} cr
            </div>
          </div>
          <div
            style={{ border: '1px solid #d0d7de', borderRadius: 6, padding: 12, flex: '1 1 180px' }}
          >
            <strong>Trust surface</strong>
            <div>{summary.agents.total} agents</div>
            <div>{summary.skills.total} skills</div>
            <div>
              reputation Δ {summary.reputation.economy_delta_sum} over{' '}
              {summary.reputation.economy_events} events
            </div>
          </div>
          <div
            style={{ border: '1px solid #d0d7de', borderRadius: 6, padding: 12, flex: '1 1 220px' }}
          >
            <strong>Wallet placeholders</strong>
            <div>{summary.wallet_placeholders.total} (inert — no keys, no activity)</div>
            <div style={{ marginTop: 6 }}>
              <strong>Token public status:</strong> <code>{summary.token_public_status}</code>
            </div>
            <div>
              <strong>Legal gate:</strong> <code>{summary.legal_gate}</code>
            </div>
          </div>
        </section>
      ) : null}

      <h2>New work order</h2>
      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 16px' }}>
        <input
          style={{ flex: '2 1 260px', padding: 8 }}
          placeholder="requester agent id"
          value={requesterId}
          onChange={(e) => setRequesterId(e.target.value)}
        />
        <input
          style={{ flex: '2 1 260px', padding: 8 }}
          placeholder="skill version id (optional)"
          value={skillVersionId}
          onChange={(e) => setSkillVersionId(e.target.value)}
        />
        <input
          style={{ flex: '2 1 260px', padding: 8 }}
          placeholder="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          style={{ flex: '1 1 100px', padding: 8 }}
          placeholder="credits"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
        />
        <button
          disabled={busy || !token || !requesterId || !title}
          onClick={() =>
            act(
              () =>
                client.createWorkOrder({
                  requester_agent_id: requesterId,
                  title,
                  skill_version_id: skillVersionId || undefined,
                  requested_credits: Number(credits),
                }),
              'Work order proposed.',
            )
          }
        >
          Propose
        </button>
      </section>

      <h2>Work orders</h2>
      <p style={{ color: '#57606a', fontSize: 13 }}>
        Accept reserves escrow (worker agent id below is used). Deliver runs the simulated execution
        and creates/links the proof. Verify is owner-only and releases escrow — refused unless the
        proof is <code>verified_fact</code>.
      </p>
      <input
        style={{ width: 340, padding: 8, marginBottom: 8 }}
        placeholder="worker agent id (for Accept)"
        value={workerId}
        onChange={(e) => setWorkerId(e.target.value)}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: 6 }}>Order</th>
            <th style={{ padding: 6 }}>Status</th>
            <th style={{ padding: 6 }}>Escrow</th>
            <th style={{ padding: 6 }}>Credits</th>
            <th style={{ padding: 6 }}>Proof / tag</th>
            <th style={{ padding: 6 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderBottom: '1px solid #d0d7de' }}>
              <td style={{ padding: 6 }}>
                <div>{o.title}</div>
                <code style={{ color: '#57606a' }}>{o.id.slice(0, 8)}…</code>
              </td>
              <td style={{ padding: 6 }}>{o.status}</td>
              <td style={{ padding: 6 }}>{o.escrow_status}</td>
              <td style={{ padding: 6 }}>{o.requested_credits}</td>
              <td style={{ padding: 6 }}>
                {o.proof_id ? (
                  <span>
                    <code>{o.proof_id.slice(0, 8)}…</code>{' '}
                    <em
                      style={{ color: o.evidence_tag === 'verified_fact' ? '#1a7f37' : '#9a6700' }}
                    >
                      {o.evidence_tag}
                    </em>
                  </span>
                ) : (
                  <span style={{ color: '#57606a' }}>none</span>
                )}
              </td>
              <td style={{ padding: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {o.status === 'proposed' ? (
                  <button
                    disabled={busy || !workerId}
                    onClick={() =>
                      act(
                        () => client.acceptWorkOrder(o.id, { worker_agent_id: workerId }),
                        'Accepted — escrow reserved.',
                      )
                    }
                  >
                    Accept
                  </button>
                ) : null}
                {o.status === 'accepted' || o.status === 'in_progress' ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(() => client.deliverWorkOrder(o.id), 'Delivered (simulated) with proof.')
                    }
                  >
                    Deliver
                  </button>
                ) : null}
                {o.status === 'delivered' ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(() => client.verifyWorkOrder(o.id), 'Verified — escrow released.')
                      }
                    >
                      Verify
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(
                          () => client.rejectWorkOrder(o.id, 'spec_not_met'),
                          'Rejected — escrow refunded.',
                        )
                      }
                    >
                      Reject
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(
                          () => client.disputeWorkOrder(o.id, 'quality_contested'),
                          'Disputed — escrow held.',
                        )
                      }
                    >
                      Dispute
                    </button>
                  </>
                ) : null}
                {o.status === 'proposed' || o.status === 'accepted' ? (
                  <button
                    disabled={busy}
                    onClick={() => act(() => client.cancelWorkOrder(o.id), 'Canceled.')}
                  >
                    Cancel
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 12, color: '#57606a' }}>
                No work orders loaded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
