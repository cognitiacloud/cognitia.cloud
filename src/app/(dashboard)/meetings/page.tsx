import { CalendarClock } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell";
import { TableContainer, EmptyState } from "@/components/ui";

export const metadata = { title: "Meetings" };

/**
 * Meetings — meeting intelligence surface. Lane A owns the frame only; the
 * meeting-intelligence lane supplies summaries, transcripts, and follow-ups.
 */
export default function MeetingsPage() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Meetings"
        subtitle="Recordings, summaries, and follow-ups."
      />
      <TableContainer title="Recent meetings">
        <EmptyState
          compact
          icon={CalendarClock}
          title="No meetings yet"
          description="Once meetings are connected, summaries and extracted actions will show up here."
        />
      </TableContainer>
    </PageContainer>
  );
}
