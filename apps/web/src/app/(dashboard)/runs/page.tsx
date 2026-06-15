'use client';

import { useState } from 'react';
import Link from 'next/link';
import { consoleClient, useAsync } from '../../../lib/useConsole';
import {
  Chip,
  statusTone,
  PageHead,
  EmptyState,
  ErrorState,
  LoadingRows,
} from '../../../components/ui';
import { summarizeRollup, runNeedsReview, runStatusOptions } from '../../../lib/runsView';
import type { RunPlanView } from '../../../lib/apiClient';

const loadRuns = () => consoleClient().runPlans();

export default function RunsPage() {
  const state = useAsync(loadRuns);
  const [filter, setFilter] = useState<string>('all');

  return (
    <>
      <PageHead title="Agent Runs" subtitle="What ran, why, what is waiting, and what was sent." />

      {state.status === 'loading' ? (
        <LoadingRows rows={5} />
      ) : state.status === 'error' ? (
        <ErrorState
          title="API not reachable"
          sub="Set NEXT_PUBLIC_API_URL and ensure the operator API is running with a valid session."
        />
      ) : state.data.runs.length === 0 ? (
        <EmptyState
          icon="runs"
          title="No agent runs yet"
          sub="Trigger a Mira run to generate evidence-grounded proposals for review."
        />
      ) : (
        <RunsBody runs={state.data.runs} filter={filter} onFilter={setFilter} />
      )}
    </>
  );
}

function RunsBody({
  runs,
  filter,
  onFilter,
}: {
  runs: RunPlanView[];
  filter: string;
  onFilter: (s: string) => void;
}) {
  const statuses = runStatusOptions(runs);
  const shown = filter === 'all' ? runs : runs.filter((r) => r.status === filter);

  return (
    <>
      <div className="filters" role="group" aria-label="Filter runs by status">
        <button
          className={filter === 'all' ? 'filter-chip on' : 'filter-chip'}
          aria-pressed={filter === 'all'}
          onClick={() => onFilter('all')}
        >
          All ({runs.length})
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            className={filter === s ? 'filter-chip on' : 'filter-chip'}
            aria-pressed={filter === s}
            onClick={() => onFilter(s)}
          >
            {s} ({runs.filter((r) => r.status === s).length})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon="runs"
          title="No runs match this filter"
          sub="Clear the filter to see all runs."
        />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Objective</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.run_id} className="row-link">
                  <td>
                    <Link href={`/runs/${r.run_id}`}>{r.objective}</Link>
                    {runNeedsReview(r) ? (
                      <>
                        {' '}
                        <Chip tone="accent">needs review</Chip>
                      </>
                    ) : null}
                  </td>
                  <td className="muted">{r.agent}</td>
                  <td>
                    <Chip tone={statusTone(r.status)}>{r.status}</Chip>
                  </td>
                  <td>
                    <span className="chip-row">
                      {summarizeRollup(r.rollup, { nonZeroOnly: true }).map((c) => (
                        <Chip key={c.key} tone={statusTone(c.key)}>
                          {c.count} {c.label.toLowerCase()}
                        </Chip>
                      ))}
                      {r.rollup.total === 0 ? <span className="muted">no actions</span> : null}
                    </span>
                  </td>
                  <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
