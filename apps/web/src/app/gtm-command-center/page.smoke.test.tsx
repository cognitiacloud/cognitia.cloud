/**
 * Smoke test: the `/gtm-command-center` route actually renders to HTML.
 *
 * The page is an ASYNC server component (it awaits the server-only adapter that
 * runs the real `@cognitia/agents` modules), so we await the component to get
 * its element tree, then render it to static markup with `react-dom/server` in
 * the node test env (no browser/Playwright). JSX is transformed via the
 * automatic runtime configured in `vitest.config.ts`.
 *
 * Asserts the key integrated surfaces appear, channels are DRY-RUN with
 * sent=false, there are no live send controls, the mock/dry-run
 * capability-surface score is shown and passes its threshold, AND the official
 * Alta implementation-parity figure is shown honestly (and is NOT claimed at
 * 100/100).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GtmCommandCenterPage from './page.js';

let html = '';

beforeAll(async () => {
  // Async server component → await to get the element, then render to markup.
  html = renderToStaticMarkup(await GtmCommandCenterPage());
});

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
    expect(html).toContain('Integrated run packet');
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

  it('shows the mock/dry-run capability-surface score passing its threshold', () => {
    expect(html).toContain('Mock/dry-run capability-surface score');
    const match = html.match(/capability-surface score:\s*<\/[^>]*>\s*<span[^>]*>\s*(\d+)\/100/i);
    const score = match
      ? Number(match[1])
      : Number((html.match(/>(\d+)\/100<\/span>/) ?? [])[1] ?? '0');
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('shows the official Alta implementation parity honestly (not claimed at 100)', () => {
    expect(html).toContain('Official Alta implementation parity');
    expect(html).toContain('Exact blockers to a confident 80+');
    // The official figure must not be advertised as 100/100.
    expect(html).not.toContain('Official Alta implementation parity (honest): 100/100');
  });
});
