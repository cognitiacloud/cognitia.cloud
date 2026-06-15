import { PageHead, EmptyState } from '../../../components/ui';

export default function MeetingsPage() {
  return (
    <>
      <PageHead
        title="Meetings"
        subtitle="Booking state, notes, AI summaries, and follow-up drafts — all review-gated."
      />
      <EmptyState
        icon="meetings"
        title="Meeting loop not yet wired"
        sub="The meetings domain (booking state, transcript ingestion, summaries, follow-up drafts, CRM writeback preview) is the next backend slice. No calendar credentials are present in this environment, so the booking path will ship as a documented seam."
      />
    </>
  );
}
