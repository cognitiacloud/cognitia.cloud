import { PlayCircle, Filter } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell";
import { Button, TableContainer, EmptyState } from "@/components/ui";

export const metadata = { title: "Runs" };

/**
 * Runs — execution history for governed workflows. Lane A owns the frame; the
 * runs lane provides rows, status badges, and a drawer for run detail / logs.
 */
export default function RunsPage() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Runs"
        subtitle="Every workflow execution and its governance trail."
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Filter className="size-3.5" />
              Filter
            </Button>
            <Button variant="primary" size="sm">
              New run
            </Button>
          </>
        }
      />
      <TableContainer
        title="All runs"
        description="Sorted by most recent"
      >
        <EmptyState
          compact
          icon={PlayCircle}
          title="No runs to show"
          description="Start a run or adjust your filters. Run rows link to a detail view with step-by-step output."
        />
      </TableContainer>
    </PageContainer>
  );
}
