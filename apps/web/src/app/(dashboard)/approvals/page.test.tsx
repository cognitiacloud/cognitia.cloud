// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import ApprovalsPage from './page';

/**
 * Clean Approvals queue (in the dashboard shell). Covers: queue renders from the
 * action list, status filter, and that opening a row reveals the decision drawer
 * with accessible decision controls. The drawer's own context fetches (rationale
 * + preview) are stubbed so the surface mounts fully.
 */

function action(over: Record<string, unknown> = {}) {
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

function stub() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/rationale'))
        return {
          status: 200,
          json: async () => ({
            action_id: 'act-1',
            target_ref: 'account:acme',
            account: null,
            score: null,
            evidence: [],
            evidence_refs_on_action: 2,
            freshness: null,
          }),
        } as Response;
      if (url.includes('/preview'))
        return {
          status: 200,
          json: async () => ({
            action_id: 'act-1',
            plan: {
              system: 'hubspot',
              object: 'tasks',
              operation: 'create',
              target_ref: 'account:acme',
              idempotency_key: 'k',
              idempotency_property: 'p',
              properties: {},
            },
            would_execute: false,
            idempotent_replay_expected: false,
            guardrail_results: [],
            evidence_refs: [],
          }),
        } as Response;
      // /agent-actions
      return {
        status: 200,
        json: async () => ({
          actions: [
            action(),
            action({
              id: 'act-2',
              approval_status: 'approved',
              risk_level: 'low',
              target_ref: 'account:globex',
            }),
          ],
        }),
      } as Response;
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Approval queue', () => {
  it('renders proposed actions by default with no serious axe violations', async () => {
    stub();
    const { container } = render(<ApprovalsPage />);
    await screen.findByText('account:acme');
    // Default filter is "proposed", so the approved action is hidden.
    expect(screen.queryByText('account:globex')).toBeNull();

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking.map((v) => v.id)).toEqual([]);
  });

  it('switches filter to show approved actions', async () => {
    stub();
    render(<ApprovalsPage />);
    await screen.findByText('account:acme');
    fireEvent.click(screen.getByRole('button', { name: /^approved/i }));
    expect(await screen.findByText('account:globex')).toBeTruthy();
    expect(screen.queryByText('account:acme')).toBeNull();
  });

  it('opens the decision drawer with approve/reject controls when a row is activated', async () => {
    stub();
    render(<ApprovalsPage />);
    const row = await screen.findByRole('button', { name: /Review CRM task for account:acme/i });
    fireEvent.click(row);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
  });
});
