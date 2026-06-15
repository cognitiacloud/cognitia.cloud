'use client';

import { consoleClient, useAsync } from '../../../lib/useConsole';
import {
  Kpi,
  Chip,
  statusTone,
  PageHead,
  Section,
  EmptyState,
  ErrorState,
  LoadingRows,
} from '../../../components/ui';
import type {
  TrustMetricsView,
  OpsOverviewView,
  IntegrationStatusView,
  RunPlanView,
} from '../../../lib/apiClient';

interface Overview {
  metrics: TrustMetricsView | null;
  ops: OpsOverviewView | null;
  integration: IntegrationStatusView | null;
  runs: RunPlanView[];
  anyReachable: boolean;
}

async function loadOverview(): Promise<Overview> {
  const api = consoleClient();
  const [metrics, ops, integration, runs] = await Promise.allSettled([
    api.trustMetrics(),
    api.opsOverview(),
    api.integrationStatus(),
    api.runPlans(),
  ]);
  const val = <T,>(r: PromiseSettledResult<T>): T | null =>
    r.status === 'fulfilled' ? r.value : null;
  const anyReachable = [metrics, ops, integration, runs].some((r) => r.status === 'fulfilled');
  return {
    metrics: val(metrics),
    ops: val(ops),
    integration: val(integration),
    runs: val(runs)?.runs ?? [],
    anyReachable,
  };
}

function num(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString();
}

export default function OverviewPage() {
  const state = useAsync(loadOverview);

  return (
    <>
      <PageHead
        title="Overview"
        subtitle="Pilot revenue-operator funnel and system health."
        action={<Chip tone="accent">Live data when the API is reachable</Chip>}
      />

      {state.status === 'loading' ? (
        <>
          <div className="kpi-row">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card kpi">
                <div className="skel" style={{ height: 12, width: '60%' }} />
                <div className="skel" style={{ height: 26, width: '40%', marginTop: 12 }} />
              </div>
            ))}
          </div>
          <LoadingRows rows={4} />
        </>
      ) : state.status === 'error' || !state.data.anyReachable ? (
        <ErrorState
          title="API not reachable"
          sub="The console is rendering, but no operator API responded. Set NEXT_PUBLIC_API_URL and ensure the API is running with a valid session."
        />
      ) : (
        <OverviewBody data={state.data} />
      )}
    </>
  );
}

function OverviewBody({ data }: { data: Overview }) {
  const m = data.metrics;
  const integ = data.integration;
  return (
    <>
      <div className="kpi-row">
        <Kpi
          icon="contacts"
          label="Outreach executed"
          value={num(m?.actions.executed)}
          foot="approved CRM writes performed"
          lead
        />
        <Kpi
          icon="approvals"
          label="Approval backlog"
          value={num(m?.actions.proposed)}
          foot="proposed actions awaiting a human"
        />
        <Kpi icon="meetings" label="Replies" value="—" foot="reply ingestion — pending" />
        <Kpi icon="meetings" label="Meetings booked" value="—" foot="booking loop — pending" />
        <Kpi
          icon="plug"
          label="Integration health"
          value={
            integ ? (
              <Chip tone={statusTone(integ.kill_switch.halted ? 'halted' : integ.status)}>
                {integ.kill_switch.halted ? 'halted' : integ.status}
              </Chip>
            ) : (
              '—'
            )
          }
          foot={integ ? integ.system : 'no integration status'}
        />
      </div>

      <Section title="Recent runs" link={{ href: '/runs', label: 'All runs' }}>
        {data.runs.length === 0 ? (
          <EmptyState
            icon="runs"
            title="No agent runs yet"
            sub="Trigger a Mira run to generate evidence-grounded proposals for review."
          />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Objective</th>
                  <th>Status</th>
                  <th>Proposed</th>
                  <th>Approved</th>
                  <th>Executed</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.slice(0, 6).map((r) => (
                  <tr key={r.run_id}>
                    <td>{r.objective}</td>
                    <td>
                      <Chip tone={statusTone(r.status)}>{r.status}</Chip>
                    </td>
                    <td>{r.rollup.proposed}</td>
                    <td>{r.rollup.approved}</td>
                    <td>{r.rollup.executed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Failed syncs & alerts" link={{ href: '/audit', label: 'Audit & trust' }}>
        {!data.ops || data.ops.failures.recent.length === 0 ? (
          <EmptyState
            icon="shield"
            title="No recent failures"
            sub="Sync and execution health is clean."
          />
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Entity</th>
                  <th>When</th>
                  <th>Trace</th>
                </tr>
              </thead>
              <tbody>
                {data.ops.failures.recent.slice(0, 6).map((f) => (
                  <tr key={f.trace_id}>
                    <td>
                      <Chip tone="danger">{f.event_name}</Chip>
                    </td>
                    <td>
                      {f.entity_type}/{f.entity_id}
                    </td>
                    <td>{new Date(f.occurred_at).toLocaleString()}</td>
                    <td className="mono">{f.trace_id.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
