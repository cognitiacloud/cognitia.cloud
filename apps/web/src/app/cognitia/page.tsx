'use client';

/**
 * COG-007 — Cognitia Command Dashboard (operator console).
 * One screen over the whole trust layer: agents/ATC, Proof Registry,
 * SkillProof, AI Front Desk, reputation, credits/wallet, crypto gates, and
 * the honest blockers panel. All numbers are computed from real rows — empty
 * states render as zeros, never as fake metrics — and only verified_fact
 * evidence counts as "verified". No raw PII reaches this surface.
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiClient, ApiError, type CommandSummaryView } from '../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401) — paste a valid token.';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

const card: React.CSSProperties = {
  border: '1px solid #d0d7de',
  borderRadius: 8,
  padding: 12,
  minWidth: 260,
  flex: '1 1 300px',
};

const Stat = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
    <span style={{ color: '#57606a' }}>{label}</span>
    <span style={{ fontWeight: strong ? 700 : 500 }}>{value}</span>
  </div>
);

const dollars = (cents: number) => `$${(cents / 100).toLocaleString()}`;

export default function CommandDashboardPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [s, setS] = useState<CommandSummaryView | null>(null);
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
      setS(await client.commandSummary());
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Cognitia Command Dashboard</h1>
      <p style={{ color: '#57606a' }}>
        The agent trust layer at a glance. Only <code>verified_fact</code> evidence counts as
        verified; simulations are labeled; gates that are closed are shown closed.
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
        <p style={{ padding: 8, background: '#ffebe9', border: '1px solid #cf222e' }}>{notice}</p>
      ) : null}

      {s ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <section style={card}>
            <h2 style={{ marginTop: 0 }}>
              <Link href="/agents">Trust layer</Link>
            </h2>
            <Stat label="Agents" value={s.trustSummary.total_agents} strong />
            <Stat label="ATC active" value={s.trustSummary.atc_active} />
            <Stat label="ATC suspended" value={s.trustSummary.atc_suspended} />
            <Stat label="ATC revoked" value={s.trustSummary.atc_revoked} />
            <Stat label="ATC expired" value={s.trustSummary.atc_expired} />
            <Stat label="Proofs total" value={s.trustSummary.total_proofs} strong />
            <Stat label="· verified_fact" value={s.trustSummary.verified_fact_proofs} />
            <Stat label="· likely_inference" value={s.trustSummary.likely_inference_proofs} />
            <Stat label="· unknown" value={s.trustSummary.unknown_proofs} />
            <Stat label="Public-safe proofs" value={s.trustSummary.public_safe_proofs} />
            <Stat
              label="PII-flagged summaries"
              value={s.trustSummary.pii_flagged_proof_summaries}
            />
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>
              <Link href="/skills">SkillProof</Link>
            </h2>
            <Stat
              label="Internal skills"
              value={s.skillproofSummary.total_internal_skills}
              strong
            />
            <Stat label="Core 20" value={s.skillproofSummary.core20_count} />
            <Stat label="Tier 0 versions" value={s.skillproofSummary.tier_0} />
            <Stat label="Tier 1 versions" value={s.skillproofSummary.tier_1} />
            <Stat label="Tier 2 versions" value={s.skillproofSummary.tier_2} />
            <Stat label="Yanked versions" value={s.skillproofSummary.yanked_versions} />
            <Stat label="Marketplace" value={String(s.skillproofSummary.marketplace)} />
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>
              <Link href="/moveros/front-desk">AI Front Desk</Link>
            </h2>
            <Stat label="Leads" value={s.frontdeskSummary.total_leads} strong />
            <Stat label="Need response" value={s.frontdeskSummary.leads_needing_response} />
            <Stat label="Simulated actions" value={s.frontdeskSummary.simulated_actions} />
            <Stat label="Human review required" value={s.frontdeskSummary.human_review_required} />
            <Stat label="Rescued" value={s.frontdeskSummary.rescued_leads} />
            <Stat label="Booking intents" value={s.frontdeskSummary.booking_intents} />
            <Stat label="Booked jobs" value={s.frontdeskSummary.booked_jobs} />
            <Stat label="Unknown outcomes" value={s.frontdeskSummary.unknown_outcomes} />
            <Stat
              label="Estimated value"
              value={dollars(s.frontdeskSummary.estimated_value_cents ?? 0)}
            />
            <Stat
              label="Verified booked value"
              value={dollars(s.frontdeskSummary.verified_booked_value_cents ?? 0)}
              strong
            />
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>Reputation</h2>
            <Stat label="Agents with snapshots" value={s.reputationSummary.agents_with_snapshots} />
            <Stat
              label="Verified completed actions"
              value={s.reputationSummary.verified_completed_actions}
              strong
            />
            <Stat label="Failed actions" value={s.reputationSummary.failed_actions} />
            <Stat label="Blocked (rejected) actions" value={s.reputationSummary.blocked_actions} />
            <Stat label="Unknown claims" value={s.reputationSummary.unknown_claims} />
            <Stat
              label="Last recalculated"
              value={
                s.reputationSummary.last_recalculated_at
                  ? new Date(s.reputationSummary.last_recalculated_at).toLocaleString()
                  : 'never'
              }
            />
            {s.reputationSummary.top_agents_by_score.length > 0 ? (
              <div style={{ marginTop: 6 }}>
                <span style={{ color: '#57606a' }}>Top agents:</span>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {s.reputationSummary.top_agents_by_score.map((a) => (
                    <li key={a.agent_id}>
                      <Link href={`/agents/${a.agent_id}`}>
                        <code>{a.agent_id.slice(0, 8)}…</code>
                      </Link>{' '}
                      — {a.score}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>
              <Link href="/credits">Credits / Wallet</Link>
            </h2>
            <Stat label="Accounts" value={s.creditsSummary.credits_accounts as number} />
            <Stat label="Ledger entries" value={s.creditsSummary.ledger_entries as number} />
            <Stat label="Wallet placeholders" value={s.creditsSummary.wallet_bindings as number} />
            <Stat
              label="Internal credits outstanding"
              value={s.creditsSummary.internal_credits_outstanding as number}
            />
            <Stat
              label="Real payment execution"
              value={String(s.creditsSummary.real_payment_execution)}
            />
            <Stat
              label="Placeholder bindings only"
              value={s.creditsSummary.placeholder_bindings_only ? 'yes' : 'NO — investigate'}
            />
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>
              <Link href="/cognitia/crypto-readiness">Crypto gates (internal)</Link>
            </h2>
            <Stat label="Legal gate" value={String(s.cryptoReadinessSummary.legal_gate)} />
            <Stat
              label="Public token"
              value={String(s.cryptoReadinessSummary.public_token_status)}
            />
            <Stat
              label="Base/EVM optionality"
              value={String(s.cryptoReadinessSummary.base_evm_optionality)}
            />
            <Stat
              label="Stablecoin/card rails"
              value={String(s.cryptoReadinessSummary.stablecoin_card_rails)}
            />
            <Stat
              label="Future refs"
              value={(s.cryptoReadinessSummary.future_integration_refs as string[]).join(', ')}
            />
            <Stat label="Token launch" value={String(s.cryptoReadinessSummary.token_launch)} />
            <Stat
              label="Exchange / staking"
              value={String(s.cryptoReadinessSummary.exchange_liquidity_staking)}
            />
          </section>

          <section style={{ ...card, flex: '1 1 100%' }}>
            <h2 style={{ marginTop: 0 }}>Blockers (honest state)</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {s.blockers.map((b) => (
                  <tr key={b.key} style={{ borderBottom: '1px solid #d0d7de' }}>
                    <td style={{ padding: 4 }}>
                      <code>{b.key}</code>
                    </td>
                    <td style={{ padding: 4, fontWeight: 600 }}>{b.status}</td>
                    <td style={{ padding: 4, color: '#57606a' }}>{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : (
        <p style={{ color: '#57606a' }}>Paste a token and load the live summary.</p>
      )}
    </main>
  );
}
