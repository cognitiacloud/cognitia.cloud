import { PageHead, EmptyState } from '../../../components/ui';

export default function RunsPage() {
  return (
    <>
      <PageHead title="Agent Runs" subtitle="What ran, why, what is waiting, what was sent." />
      <EmptyState
        icon="runs"
        title="Runs view is being wired"
        sub="The API already exposes runs with governance rollups (/agent-runs). This page renders that list and per-run timelines in the next slice."
      />
    </>
  );
}
