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
  type EconomyAgentActionView,
  type EconomySummaryView,
  type WorkOrderView,
} from '../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401).';
    if (err.status === 403)
      return 'Insufficient permission (403) — verification and dispute arbitration are owner-only; acceptance needs an active ATC.';
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
  const [agentActions, setAgentActions] = useState<EconomyAgentActionView[]>([]);
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
      const [s, o, a] = await Promise.all([
        client.economySummary(),
        client.listWorkOrders(),
        client.listEconomyActions(),
      ]);
      setSummary(s);
      setOrders(o.work_orders);
      setAgentActions(a.actions);
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
              {summary.escrow.disputed_credits} cr · resolved {summary.escrow.resolved_credits} cr
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
                {o.status === 'disputed' ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(
                          () =>
                            client.resolveWorkOrder(o.id, {
                              decision: 'release',
                              reason_code: 'arbitration_for_worker',
                            }),
                          'Resolved — held escrow released to the worker.',
                        )
                      }
                    >
                      Resolve: release
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(
                          () =>
                            client.resolveWorkOrder(o.id, {
                              decision: 'refund',
                              reason_code: 'arbitration_for_requester',
                            }),
                          'Resolved — held escrow refunded to the requester.',
                        )
                      }
                    >
                      Resolve: refund
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        const worker = Math.floor(o.requested_credits / 2);
                        return act(
                          () =>
                            client.resolveWorkOrder(o.id, {
                              decision: 'split',
                              reason_code: 'arbitration_split',
                              worker_credits: worker,
                              requester_credits: o.requested_credits - worker,
                            }),
                          'Resolved — held escrow split between both sides.',
                        );
                      }}
                    >
                      Resolve: split 50/50
                    </button>
                  </>
                ) : null}
                {o.status === 'resolved' && o.resolution ? (
                  <span style={{ color: '#57606a', fontSize: 13 }}>
                    arbitrated: {o.resolution.decision} ({o.resolution.worker_credits} cr worker /{' '}
                    {o.resolution.requester_credits} cr requester)
                  </span>
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

      <h2>Agent proposals (Action Ledger)</h2>
      <p style={{ color: '#57606a', fontSize: 13 }}>
        Agents propose accept/deliver/dispute here (active ATC + explicit permission,
        deny-by-default). Every ask is <strong>approval required</strong>; execution runs the same
        safe service path as the buttons above.{' '}
        <strong>Verify and dispute arbitration stay owner-only</strong> — they are never
        agent-proposable.
      </p>
      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
        <button
          disabled={busy || !workerId || orders.every((o) => o.status !== 'proposed')}
          onClick={() => {
            const target = orders.find((o) => o.status === 'proposed');
            if (!target) return;
            return act(
              () => client.proposeEconomyAction(target.id, 'accept', { agent_id: workerId }),
              'Agent ask filed: accept (approval required).',
            );
          }}
        >
          Agent: propose accept (first open order)
        </button>
        <button
          disabled={busy || !workerId || orders.every((o) => o.status !== 'accepted')}
          onClick={() => {
            const target = orders.find((o) => o.status === 'accepted');
            if (!target) return;
            return act(
              () =>
                client.proposeEconomyAction(target.id, 'deliver', {
                  agent_id: workerId,
                  result_summary: 'agent-driven delivery',
                }),
              'Agent ask filed: deliver (approval required).',
            );
          }}
        >
          Agent: propose deliver (first accepted order)
        </button>
      </section>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: 6 }}>Ask</th>
            <th style={{ padding: 6 }}>Ledger status</th>
            <th style={{ padding: 6 }}>Proof</th>
            <th style={{ padding: 6 }}>Decision</th>
            <th style={{ padding: 6 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {agentActions.map((a) => {
            const decision = a.decisions[a.decisions.length - 1];
            return (
              <tr key={a.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                <td style={{ padding: 6 }}>
                  <div>{a.action_type.replace('economy.work_order.', '')}</div>
                  <code style={{ color: '#57606a' }}>{a.target_ref}</code>
                </td>
                <td style={{ padding: 6 }}>
                  {a.approval_status === 'proposed' ? (
                    <span
                      style={{
                        background: '#fff8c5',
                        border: '1px solid #d4a72c',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 12,
                      }}
                    >
                      approval required
                    </span>
                  ) : (
                    <span>{a.approval_status}</span>
                  )}{' '}
                  <span style={{ color: '#57606a', fontSize: 13 }}>· {a.execution_status}</span>
                </td>
                <td style={{ padding: 6 }}>
                  {a.proof_id ? <code>{a.proof_id.slice(0, 8)}…</code> : '—'}
                </td>
                <td style={{ padding: 6, fontSize: 13, color: '#57606a' }}>
                  {decision
                    ? `${decision.label} by ${String(decision.detail.approver_ref ?? '?')} (${String(
                        decision.detail.reason_code ?? '',
                      )})`
                    : 'awaiting human decision'}
                </td>
                <td style={{ padding: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {a.approval_status === 'proposed' ? (
                    <>
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => client.approve(a.id, { reason_code: 'meets_playbook' }),
                            'Ask approved on the ledger.',
                          )
                        }
                      >
                        Approve
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => client.reject(a.id, { reason_code: 'policy_or_risk' }),
                            'Ask rejected on the ledger.',
                          )
                        }
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {a.approval_status === 'approved' && a.execution_status === 'pending' ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(
                          () => client.executeEconomyAction(a.id),
                          'Approved ask executed via the safe service path.',
                        )
                      }
                    >
                      Execute
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {agentActions.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 12, color: '#57606a' }}>
                No agent asks on the ledger.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
