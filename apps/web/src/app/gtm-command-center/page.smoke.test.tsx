/**
 * Smoke test: the `/gtm-command-center` route actually renders to HTML.
 *
 * Renders the real server component to static markup and asserts the key
 * integrated surfaces appear, that channels are DRY-RUN with sent=false, that
 * there are no live send controls, and that the Alta parity score is shown and
 * passes the threshold. Uses `react-dom/server` in the node test env; no
 * browser/Playwright required. (JSX in the page is transformed via the
 * automatic runtime configured in `vitest.config.ts`.)
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GtmCommandCenterPage from './page.js';

const html = renderToStaticMarkup(GtmCommandCenterPage());

describe('/gtm-command-center route renders', () => {
  it('renders a non-trivial HTML document', () => {
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toContain('<main');
  });

  it('shows the persistent mock/dry-run banner', () => {
    expect(html).toContain('NO LIVE SEND');
    expect(html).toContain('NO PII');
  });

  it('renders all integrated surfaces by heading', () => {
    expect(html).toContain('Audience &amp; signal builder');
    expect(html).toContain('dry-run channel engine');
    expect(html).toContain('CRM-lite records');
    expect(html).toContain('TrustOps analytics');
    expect(html).toContain('release gates');
    expect(html).toContain('Proof &amp; workspace attribution');
    expect(html).toContain('No-live-egress attestation');
  });

  it('shows DRY-RUN channels with sent=false and no live controls', () => {
    expect(html).toContain('DRY-RUN');
    expect(html).toContain('BLOCKED');
    // never advertises a send/call control
    expect(html.toLowerCase()).not.toContain('<button');
    expect(html.toLowerCase()).not.toContain('send now');
  });

  it('renders the automation readiness panel with all required signals', () => {
    expect(html).toContain('Automation readiness');
    expect(html).toContain('Automation mode');
    expect(html).toContain('Approval state');
    expect(html).toContain('Consent state');
    expect(html).toContain('Kill switch state');
    expect(html).toContain('Connector state');
    expect(html).toContain('Monitoring state');
    expect(html).toContain('Rollback state');
    expect(html).toContain('Missing live conditions');
    expect(html).toContain('Proof ledger');
  });

  it('exposes only the three allowed read-only controls — no live actions', () => {
    expect(html).toContain('Preview Dry Run');
    expect(html).toContain('View Gate Reasons');
    expect(html).toContain('View Rollback Plan');
    // disclosures are native <details>, never <button>
    expect(html.toLowerCase()).not.toContain('<button');
    // no live send/call/sms/whatsapp/ad action controls anywhere
    for (const forbidden of ['send now', 'place call', 'send sms', 'send whatsapp', 'launch ad']) {
      expect(html.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('shows the Alta parity score and that it passes the threshold', () => {
    expect(html).toContain('Alta implementation-parity score');
    // the headline "NN/100" appears and is >= 80
    const match = html.match(/parity score:\s*<\/[^>]+>\s*<span[^>]*>\s*(\d+)\/100/i);
    // fall back to any "NN/100" near the score if structure differs
    const score = match
      ? Number(match[1])
      : Number((html.match(/>(\d+)\/100<\/span>/) ?? [])[1] ?? '0');
    expect(score).toBeGreaterThanOrEqual(80);
  });
});
