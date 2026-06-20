import type { SourceRisk } from '@cognitia/core';
import { DATA_SOURCES, isSourceUsable } from '../../../../lib/dataSources';

/**
 * Portal → Settings → Data Sources.
 *
 * Renders the data-source matrix (PR #91) using the shared `@cognitia/core`
 * `DataSource` type (#97): allowed/disallowed use, risk level, production status,
 * and notes. Read-only and demo-safe — declares posture; it does not crawl.
 */

export const metadata = { title: 'Data Sources — Sales Closer' };

const RISK_COLOR: Record<SourceRisk, string> = {
  low: '#1a7f37',
  medium: '#9a6700',
  high: '#bc4c00',
  blocked: '#cf222e',
};

export default function DataSourcesPage() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <p style={{ fontSize: 13, color: '#57606a' }}>
        <a href="/portal/settings">← Compliance &amp; Channels</a>
      </p>
      <h1 style={{ fontSize: 24 }}>Data Sources</h1>
      <p style={{ color: '#57606a' }}>
        Registry-anchored, not scrape-anchored. Authoritative public registries are the spine;
        third-party platforms are prototype / legal-review only. Source of record: the Sales Closer
        data-source strategy memo (PR #91).
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #d0d7de' }}>
            <th style={{ padding: '8px 6px' }}>Source</th>
            <th style={{ padding: '8px 6px' }}>Allowed use</th>
            <th style={{ padding: '8px 6px' }}>Disallowed use</th>
            <th style={{ padding: '8px 6px' }}>Risk</th>
            <th style={{ padding: '8px 6px' }}>Production status</th>
            <th style={{ padding: '8px 6px' }}>Usable</th>
          </tr>
        </thead>
        <tbody>
          {DATA_SOURCES.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eaeef2', verticalAlign: 'top' }}>
              <td style={{ padding: '8px 6px', fontWeight: 600 }}>{s.name}</td>
              <td style={{ padding: '8px 6px', color: '#24292f' }}>{s.allowedUse}</td>
              <td style={{ padding: '8px 6px', color: '#57606a' }}>{s.disallowedUse}</td>
              <td style={{ padding: '8px 6px', color: RISK_COLOR[s.riskLevel], fontWeight: 600 }}>
                {s.riskLevel}
              </td>
              <td style={{ padding: '8px 6px' }}>{s.productionStatus}</td>
              <td style={{ padding: '8px 6px', fontWeight: 600 }}>
                {isSourceUsable(s) ? (
                  <span style={{ color: '#1a7f37' }}>usable</span>
                ) : (
                  <span style={{ color: '#cf222e' }}>blocked</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 24, fontSize: 12, color: '#8c959f' }}>
        “Usable” means not hard-blocked; production-readiness is the separate Production status
        column. Prototype / legal-review / high-risk sources are not used for production prospecting
        without legal review and a compliant replacement. No live scraping or enrichment runs in
        this demo.
      </p>
    </main>
  );
}
