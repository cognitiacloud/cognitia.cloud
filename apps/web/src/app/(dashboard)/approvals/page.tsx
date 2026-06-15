'use client';

import { useState } from 'react';
import Link from 'next/link';
import { consoleClient, useReloadable } from '../../../lib/useConsole';
import {
  Chip,
  statusTone,
  PageHead,
  EmptyState,
  ErrorState,
  LoadingRows,
} from '../../../components/ui';
import { ActionDrawer } from '../../../components/ActionDrawer';
import { actionTypeLabel } from '../../../lib/runsView';
import type { AgentActionView } from '../../../lib/apiClient';

const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
const FILTERS = ['proposed', 'approved', 'rejected', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const loadActions = () => consoleClient().listActions();

export default function ApprovalsPage() {
  const [state, reload] = useReloadable(loadActions);
  const [filter, setFilter] = useState<Filter>('proposed');
  const [selected, setSelected] = useState<AgentActionView | null>(null);

  return (
    <>
      <PageHead
        title="Approval Queue"
        subtitle="Every external side effect is gated here. Review the evidence, then approve or reject."
        action={
          <Link href="/console-classic" className="btn ghost sm">
            Classic console
          </Link>
        }
      />

      {state.status === 'loading' ? (
        <LoadingRows rows={5} />
      ) : state.status === 'error' ? (
        <ErrorState
          title="API not reachable"
          sub="Set NEXT_PUBLIC_API_URL and ensure the operator API is running with a valid session."
        />
      ) : (
        <ApprovalsBody
          actions={state.data.actions}
          filter={filter}
          onFilter={setFilter}
          selected={selected}
          onOpen={setSelected}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}

function ApprovalsBody({
  actions,
  filter,
  onFilter,
  selected,
  onOpen,
  onClose,
  onChanged,
}: {
  actions: AgentActionView[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  selected: AgentActionView | null;
  onOpen: (a: AgentActionView) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const count = (f: Filter) =>
    f === 'all' ? actions.length : actions.filter((a) => a.approval_status === f).length;
  const shown = (filter === 'all' ? actions : actions.filter((a) => a.approval_status === filter))
    .slice()
    .sort((a, b) => (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9));

  return (
    <>
      <div className="filters" role="group" aria-label="Filter actions by approval status">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={filter === f ? 'filter-chip on' : 'filter-chip'}
            aria-pressed={filter === f}
            onClick={() => onFilter(f)}
          >
            {f} ({count(f)})
          </button>
        ))}
      </div>

      {actions.length === 0 ? (
        <EmptyState
          icon="approvals"
          title="The queue is clear"
          sub="No agent actions are awaiting review."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="approvals"
          title={`No ${filter} actions`}
          sub="Switch filters to see actions in other states."
        />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Target</th>
                <th>Risk</th>
                <th>Evidence</th>
                <th>Approval</th>
                <th>Execution</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr
                  key={a.id}
                  className="row-link"
                  onClick={() => onOpen(a)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Review ${actionTypeLabel(a.action_type)} for ${a.target_ref}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(a);
                    }
                  }}
                >
                  <td>{actionTypeLabel(a.action_type)}</td>
                  <td className="mono">{a.target_ref}</td>
                  <td className="muted">{a.risk_level}</td>
                  <td className="muted">
                    {a.evidence_refs.length} ref{a.evidence_refs.length === 1 ? '' : 's'}
                  </td>
                  <td>
                    <Chip tone={statusTone(a.approval_status)}>{a.approval_status}</Chip>
                  </td>
                  <td>
                    <Chip tone={statusTone(a.execution_status)}>{a.execution_status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <ActionDrawer
          key={selected.id}
          actionId={selected.id}
          approvalStatus={selected.approval_status}
          executionStatus={selected.execution_status}
          actionType={selected.action_type}
          riskLevel={selected.risk_level}
          targetRef={selected.target_ref}
          onClose={onClose}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}
