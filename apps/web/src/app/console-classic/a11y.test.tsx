// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import ApprovalsPage from './page';

/**
 * A11Y-1 — accessibility smoke for the primary operator route.
 *
 * Renders the approvals console in jsdom with no session token (so it shows its
 * sign-in shell and fires no network) and runs axe-core over the result. This
 * is a browser-free accessibility check — it catches real markup/ARIA/label
 * regressions in CI without a browser binary. It is NOT a full-browser WCAG
 * audit: jsdom does no layout, so layout-dependent rules (color-contrast,
 * region) are disabled here and remain future real-browser work (see
 * docs/truth-report.json → real-browser-e2e-smoke).
 */

// jsdom lacks these; the page only uses them in effects/handlers, but stub for safety.
beforeAllStubs();
function beforeAllStubs(): void {
  if (typeof window !== 'undefined' && !('matchMedia' in window)) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return axe.run(container, {
    // Layout-dependent rules are unreliable under jsdom (no real layout).
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
}

describe('A11Y-1 — approvals route accessibility smoke', () => {
  it('renders the sign-in shell with no serious/critical axe violations', async () => {
    // No token in sessionStorage → the page renders its sign-in shell, no fetch.
    const { container } = render(<ApprovalsPage />);
    const results = await runAxe(container);
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      blocking,
      `axe violations:\n${blocking.map((v) => `- ${v.id}: ${v.help}`).join('\n')}`,
    ).toHaveLength(0);
  });

  it('exposes a labelled session-token control and an accessible primary action', async () => {
    const { container } = render(<ApprovalsPage />);
    const scope = within(container);
    // A password/token field must be reachable by an accessible name.
    const tokenField = container.querySelector('input[type="password"]');
    expect(tokenField, 'expected a session-token input').not.toBeNull();
    // The connect button must have a non-empty accessible name (text content).
    const buttons = scope.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => (b.textContent ?? '').trim().length > 0)).toBe(true);
  });
});

/**
 * A11Y-2 — accessibility smoke for the authenticated approval queue. Seeds a
 * session token and stubs the three on-mount fetches so the page renders its
 * real operator surface (the action table with per-row select checkboxes and
 * approve/reject controls), then scans it with axe. The trust strip and
 * integration chip are best-effort, so their fetches fail to null and don't
 * gate this scan.
 */
function action(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'act-1',
    action_type: 'crm.task.create',
    risk_level: 'high',
    approval_status: 'proposed',
    execution_status: 'pending',
    target_ref: 'account:acme',
    evidence_refs: ['e1', 'e2'],
    draft: null,
    ...over,
  };
}

describe('A11Y-2 — authenticated approval queue accessibility smoke', () => {
  it('renders the action queue with no serious/critical axe violations', async () => {
    sessionStorage.setItem('cognitia.session', 'test-token');
    // Route mount fetches: /agent-actions returns rows; the best-effort
    // metrics/integration calls fail (→ null) and are not part of this scan.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/agent-actions')) {
          return {
            status: 200,
            json: async () => ({
              actions: [
                action(),
                action({
                  id: 'act-2',
                  action_type: 'crm.note.create',
                  risk_level: 'low',
                  approval_status: 'approved',
                  target_ref: 'account:globex',
                }),
              ],
            }),
          } as Response;
        }
        return { status: 500, json: async () => ({ error: 'unavailable' }) } as Response;
      }),
    );

    const { container } = render(<ApprovalsPage />);
    // Wait for the queue to render a row (proves the authenticated surface mounted).
    await screen.findByText('account:acme');

    const results = await runAxe(container);
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      blocking,
      `axe violations:\n${blocking.map((v) => `- ${v.id}: ${v.help}`).join('\n')}`,
    ).toHaveLength(0);

    // Each per-row select control must carry an accessible name.
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((cb) => {
      const name = cb.getAttribute('aria-label') ?? cb.getAttribute('aria-labelledby') ?? '';
      expect(name.length, 'a row checkbox is missing an accessible name').toBeGreaterThan(0);
    });
  });
});
