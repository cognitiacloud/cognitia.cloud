import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ApprovalQueue } from '@/components/portal/ApprovalQueue';

export const metadata: Metadata = { title: 'AI Approvals' };

export default function AiApprovalsPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Trust &amp; governance"
        title="AI approval queue"
        description="Human approval gates for every sensitive AI draft — nothing sends without sign-off."
      />
      <ApprovalQueue />
    </>
  );
}
