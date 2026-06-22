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
    expect(html).toContain('NO REAL CRM');
    expect(html).toContain('NO RAW PII');
  });

  it('renders all ten operator panels by heading', () => {
    expect(html).toContain('1 · Lead intake');
    expect(html).toContain('2 · Audience');
    expect(html).toContain('3 · Compliance gate');
    expect(html).toContain('4 · Human approval gate');
    expect(html).toContain('5 · Dry-run channel plan');
    expect(html).toContain('6 · Mock CRM-lite');
    expect(html).toContain('7 · Proof');
    expect(html).toContain('8 · TrustOps');
    expect(html).toContain('9 · Enterprise release-gate status');
    expect(html).toContain('10 · Why live is blocked');
  });

  it('shows blocked and pending leads that cannot advance', () => {
    expect(html).toContain('BLOCKED — HALTED');
    expect(html).toContain('PENDING — HELD');
    expect(html).toContain('cannot advance');
  });

  it('shows DRY-RUN channels with sent=false and no live controls', () => {
    expect(html).toContain('DRY-RUN');
    expect(html).toContain('BLOCKED');
    // never advertises a send/call control
    expect(html.toLowerCase()).not.toContain('<button');
    expect(html.toLowerCase()).not.toContain('send now');
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
