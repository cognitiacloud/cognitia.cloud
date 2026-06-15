import { PageHead, EmptyState } from '../../../components/ui';

export default function AuditPage() {
  return (
    <>
      <PageHead
        title="Audit & Trust"
        subtitle="Chain verification, anchor status, and the approval/execution record."
      />
      <EmptyState
        icon="audit"
        title="Audit view is being wired"
        sub="The trust backbone already exists in the API (/audit/verify, /audit/anchor/verify, /governance, retention). This page surfaces verification status and the recent approval chain to operators in the next slice."
      />
    </>
  );
}
