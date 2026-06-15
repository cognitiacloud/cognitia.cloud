'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { consoleClient, useReloadable } from '../../../../lib/useConsole';
import {
  Chip,
  statusTone,
  PageHead,
  EmptyState,
  ErrorState,
  LoadingRows,
} from '../../../../components/ui';
import { ActionDrawer } from '../../../../components/ActionDrawer';
import { summarizeRollup, actionTypeLabel } from '../../../../lib/runsView';
import type { RunDetailView, RunTimelineActionView } from '../../../../lib/apiClient';

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [state, reload] = useReloadable<RunDetailView>(() => consoleClient().runDetail(id));
  const [selected, setSelected] = useState<RunTimelineActionView | null>(null);

  return (
    <>
      <PageHead
        title="Run detail"
        subtitle="The action timeline for this run — proposed, approved, executed, or reversed."
        action={
          <Link href="/runs" className="btn ghost sm">
            ← All runs
          </Link>
        }
      />

      {state.status === 'loading' ? (
        <LoadingRows rows={5} />
      ) : state.status === 'error' ? (
        <ErrorState
          title="Run not available"
          sub="The run could not be loaded. Confirm the operator API is reachable and the run id is valid."
        />
      ) : (
        <RunDetailBody
          detail={state.data}
          onOpen={setSelected}
          selected={selected}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}

function RunDetailBody({
  detail,
  onOpen,
  selected,
  onClose,
  onChanged,
}: {
  detail: RunDetailView;
  onOpen: (a: RunTimelineActionView) => void;
  selected: RunTimelineActionView | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { run, rollup, actions } = detail;

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          <Chip tone={statusTone(run.status)}>{run.status}</Chip>
          <span className="muted">{run.agent}</span>
          <span className="muted">· {new Date(run.created_at).toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{run.objective}</div>
        <div className="chip-row">
          {summarizeRollup(rollup).map((c) => (
            <Chip key={c.key} tone={statusTone(c.key)}>
              {c.count} {c.label.toLowerCase()}
            </Chip>
          ))}
        </div>
      </div>

      {run.status === 'failed' ? (
        <div className="notice danger">
          This run failed. Some proposals may be incomplete — review the timeline below for failed
          actions.
        </div>
      ) : null}

      {actions.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No actions in this run"
          sub="This run produced no governed actions."
        />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Target</th>
                <th>Risk</th>
                <th>Approval</th>
                <th>Execution</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr
                  key={a.id}
                  className="row-link"
                  onClick={() => onOpen(a)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${actionTypeLabel(a.action_type)} for ${a.target_ref}`}
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
                  <td>
                    <Chip tone={statusTone(a.approval_status)}>{a.approval_status}</Chip>
                  </td>
                  <td>
                    <Chip tone={statusTone(a.execution_status)}>{a.execution_status}</Chip>
                  </td>
                  <td className="muted">{new Date(a.created_at).toLocaleString()}</td>
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
