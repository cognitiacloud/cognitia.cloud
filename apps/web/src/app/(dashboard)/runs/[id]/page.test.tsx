// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import axe from 'axe-core';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'r1' }) }));

import RunDetailPage from './page';

/** Run detail — timeline rendering, failure visibility, and drawer wiring. */

const DETAIL = {
  run: {
    id: 'r1',
    agent: 'mira',
    objective: 'Build outbound pipeline',
    status: 'failed',
    created_at: '2026-06-10T00:00:00.000Z',
  },
  rollup: {
    total: 2,
    proposed: 0,
    approved: 1,
    rejected: 0,
    executed: 1,
    rolled_back: 0,
    action_types: { 'crm.task.create': 2 },
  },
  actions: [
    {
      id: 'a1',
      action_type: 'crm.task.create',
      risk_level: 'low',
      approval_status: 'approved',
      execution_status: 'executed',
      target_ref: 'account:acme',
      created_at: '2026-06-10T00:00:00.000Z',
    },
    {
      id: 'a2',
      action_type: 'crm.note.create',
      risk_level: 'high',
      approval_status: 'approved',
      execution_status: 'failed',
      target_ref: 'account:globex',
      created_at: '2026-06-10T00:01:00.000Z',
    },
  ],
};

function stub() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/rationale'))
        return {
          status: 200,
          json: async () => ({
            action_id: 'a1',
            target_ref: 'account:acme',
            account: null,
            score: null,
            evidence: [],
            evidence_refs_on_action: 0,
            freshness: null,
          }),
        } as Response;
      if (url.includes('/preview'))
        return {
          status: 200,
          json: async () => ({
            action_id: 'a1',
            plan: {
              system: 'hubspot',
              object: 'tasks',
              operation: 'create',
              target_ref: 'account:acme',
              idempotency_key: 'k',
              idempotency_property: 'p',
              properties: {},
            },
            would_execute: true,
            idempotent_replay_expected: false,
            guardrail_results: [],
            evidence_refs: [],
          }),
        } as Response;
      return { status: 200, json: async () => DETAIL } as Response;
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Run detail', () => {
  it('renders the timeline with a failed-run banner and failure chips, no serious axe violations', async () => {
    stub();
    const { container } = render(<RunDetailPage />);
    await screen.findByText('Build outbound pipeline');
    expect(screen.getByText(/this run failed/i)).toBeTruthy();
    // Both the run status chip and the failed action's execution chip read "failed".
    expect(screen.getAllByText('failed').length).toBeGreaterThanOrEqual(2);

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking.map((v) => v.id)).toEqual([]);
  });

  it('opens the action drawer from a timeline row', async () => {
    stub();
    render(<RunDetailPage />);
    const row = await screen.findByRole('button', { name: /Open CRM task for account:acme/i });
    fireEvent.click(row);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
