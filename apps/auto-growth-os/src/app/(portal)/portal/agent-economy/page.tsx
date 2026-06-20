import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { AgentRoster } from '@/components/portal/AgentRoster';

export const metadata: Metadata = { title: 'Agent Economy' };

export default function AgentEconomyPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Trust &amp; governance"
        title="Cognitia agent economy"
        description="Active agents, their permissions and risk boundaries, recent ledger activity, and the human-approval gates that govern them."
      />
      <AgentRoster />
    </>
  );
}
