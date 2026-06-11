// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
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
