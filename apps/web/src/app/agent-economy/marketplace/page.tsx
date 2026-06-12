'use client';

/**
 * AGENT-ECONOMY-004 — internal Marketplace Lab console (operators only).
 *
 * Discoverable internal listings (agent service / skill / workflow) with
 * tier-aware, reputation-aware, ATC-aware matching. Matches are
 * `likely_inference` proposals — never guarantees, never a price. A listing
 * moves no credits and no reputation by itself. The public-token posture is
 * locked (disabled / legal gate not passed) and this page repeats it. No real
 * payments, no token transfers, no public marketplace.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ApiClient,
  ApiError,
  type MarketplaceListingView,
  type MarketplaceSummaryView,
} from '../../../lib/apiClient';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function explainError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Session invalid or expired (401).';
    if (err.status === 403) return 'Insufficient permission (403).';
    if (err.status === 409)
      return 'Refused (409) — a listing rule (yanked skill / inactive ATC / tier-0 scope) blocked this.';
    if (err.status === 422) return 'Credits outside the listing range (422).';
    if (err.status === 400)
      return 'Invalid listing (400) — internal/tenant/private only; no price.';
    return `API error (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

const badge = (text: string, color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 11,
  background: color,
  color: '#fff',
  marginRight: 4,
});

export default function MarketplaceLabPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState('');
  const [summary, setSummary] = useState<MarketplaceSummaryView | null>(null);
  const [listings, setListings] = useState<MarketplaceListingView[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create-listing form (internal credits estimate only — never a price).
  const [title, setTitle] = useState('Produce an evidence-tagged research brief');
  const [listingType, setListingType] = useState('skill_execution');
  const [creditsMin, setCreditsMin] = useState('50');
  const [creditsMax, setCreditsMax] = useState('200');

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
      setListings((await client.listListings()).listings);
      setSummary(await client.marketplaceSummary());
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const createListing = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      await client.createListing({
        listing_type: listingType,
        title,
        visibility: 'internal',
        status: 'active',
        proof_required: true,
        requested_credits_min: Number(creditsMin),
        requested_credits_max: Number(creditsMax),
      });
      setNotice('Internal listing created.');
      await refresh();
    } catch (err) {
      setNotice(explainError(err));
    } finally {
      setBusy(false);
    }
  }, [client, listingType, title, creditsMin, creditsMax, refresh]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      setBusy(true);
      setNotice(null);
      try {
        await fn();
        setNotice(ok);
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
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20 }}>Internal Marketplace Lab</h1>
      <p style={{ color: '#6b7280', fontSize: 13 }}>
        Discoverable internal listings with tier-, reputation-, and ATC-aware matching. Matches are
        likely-inference proposals, not guarantees. Internal credits estimate only — no price, no
        token, no real payments.
      </p>

      <div style={{ margin: '12px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="API base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: 6 }}
        />
        <input
          type="password"
          placeholder="operator session token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: 6 }}
        />
        <button onClick={() => void refresh()} disabled={busy}>
          Load marketplace
        </button>
      </div>

      {summary && (
        <div
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            padding: 12,
            borderRadius: 8,
          }}
        >
          <strong>{summary.listings.total}</strong> internal listings · rail: {summary.rail} ·{' '}
          <span style={badge('token public status: disabled', '#6b7280')}>
            token public status: disabled
          </span>
          <span style={badge('legal gate: not passed', '#b45309')}>legal gate: not passed</span>
        </div>
      )}

      {notice && <p style={{ color: '#b91c1c', fontSize: 13 }}>{notice}</p>}

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15 }}>Create internal listing</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ flex: 2, minWidth: 240, padding: 6 }}
          />
          <select
            value={listingType}
            onChange={(e) => setListingType(e.target.value)}
            style={{ padding: 6 }}
          >
            {[
              'agent_service',
              'skill_execution',
              'workflow',
              'verifier_service',
              'research_task',
              'gtm_task',
              'support_task',
              'internal_only',
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={creditsMin}
            onChange={(e) => setCreditsMin(e.target.value)}
            style={{ width: 90, padding: 6 }}
            placeholder="credits min"
          />
          <input
            value={creditsMax}
            onChange={(e) => setCreditsMax(e.target.value)}
            style={{ width: 90, padding: 6 }}
            placeholder="credits max"
          />
          <button onClick={() => void createListing()} disabled={busy}>
            Create internal listing
          </button>
        </div>
        <p style={{ color: '#9ca3af', fontSize: 12 }}>
          Credits are an internal estimate range — proof required.
        </p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15 }}>Listings</h2>
        {listings.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 13 }}>No listings yet — create one above.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: 4 }}>Title</th>
                <th style={{ padding: 4 }}>Type</th>
                <th style={{ padding: 4 }}>Status</th>
                <th style={{ padding: 4 }}>Visibility</th>
                <th style={{ padding: 4 }}>Risk</th>
                <th style={{ padding: 4 }}>Credits estimate</th>
                <th style={{ padding: 4 }}>Proof</th>
                <th style={{ padding: 4 }}>Request work</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 4 }}>
                    {l.title} <span style={badge('internal-only', '#374151')}>internal-only</span>
                  </td>
                  <td style={{ padding: 4 }}>{l.listing_type}</td>
                  <td style={{ padding: 4 }}>{l.status}</td>
                  <td style={{ padding: 4 }}>{l.visibility}</td>
                  <td style={{ padding: 4 }}>{l.risk_level}</td>
                  <td style={{ padding: 4 }}>
                    {l.requested_credits_min ?? '—'}–{l.requested_credits_max ?? '—'}
                  </td>
                  <td style={{ padding: 4 }}>{l.proof_required ? 'required' : 'no'}</td>
                  <td style={{ padding: 4, display: 'flex', gap: 4 }}>
                    {l.status === 'active' && (
                      <button
                        onClick={() => void act(() => client.pauseListing(l.id), 'Paused.')}
                        disabled={busy}
                      >
                        Pause
                      </button>
                    )}
                    {l.status !== 'yanked' && l.status !== 'archived' && (
                      <button
                        onClick={() => void act(() => client.yankListing(l.id), 'Yanked.')}
                        disabled={busy}
                      >
                        Yank
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
