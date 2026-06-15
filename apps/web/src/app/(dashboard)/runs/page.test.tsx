// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import RunsPage from './page';

/** Runs list — accessibility + filter behaviour over stubbed RUN-1 rollups. */

function run(over: Record<string, unknown> = {}) {
  return {
    run_id: 'r1',
    agent: 'mira',
    objective: 'Build outbound pipeline',
    status: 'completed',
    created_at: '2026-06-10T00:00:00.000Z',
    rollup: {
      total: 3,
      proposed: 1,
      approved: 1,
      rejected: 0,
      executed: 1,
      rolled_back: 0,
      action_types: { 'crm.task.create': 2, 'crm.note.create': 1 },
    },
    fully_reviewed: false,
    ...over,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Runs list', () => {
  it('renders runs with rollup chips and a needs-review marker, no serious axe violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        json: async () => ({
          runs: [
            run(),
            run({ run_id: 'r2', status: 'failed', fully_reviewed: true, objective: 'Second run' }),
          ],
        }),
      })) as unknown as typeof fetch,
    );

    const { container } = render(<RunsPage />);
    await screen.findByText('Build outbound pipeline');
    expect(screen.getByText('needs review')).toBeTruthy();

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking.map((v) => v.id)).toEqual([]);
  });

  it('filters the table by run status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        json: async () => ({
          runs: [
            run({ run_id: 'r1', status: 'completed', objective: 'Completed run' }),
            run({ run_id: 'r2', status: 'failed', objective: 'Failed run' }),
          ],
        }),
      })) as unknown as typeof fetch,
    );

    render(<RunsPage />);
    await screen.findByText('Completed run');
    expect(screen.queryByText('Failed run')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^completed/i }));
    expect(screen.queryByText('Failed run')).toBeNull();
    expect(screen.queryByText('Completed run')).toBeTruthy();
  });

  it('shows the empty state when there are no runs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        json: async () => ({ runs: [] }),
      })) as unknown as typeof fetch,
    );
    render(<RunsPage />);
    expect(await screen.findByText('No agent runs yet')).toBeTruthy();
  });
});
