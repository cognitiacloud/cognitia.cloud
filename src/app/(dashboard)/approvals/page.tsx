import { ShieldCheck, Filter } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell";
import { Button, TableContainer, EmptyState } from "@/components/ui";

export const metadata = { title: "Approvals" };

/**
 * Approvals queue — the human-in-the-loop surface. Lane A provides the page
 * frame and table container; the approvals lane fills rows and wires the detail
 * Drawer (see `@/components/ui` Drawer) for approve/reject flows.
 */
export default function ApprovalsPage() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Approvals"
        subtitle="Review and decide on actions the operator has proposed."
        actions={
          <Button variant="secondary" size="sm">
            <Filter className="size-3.5" />
            Filter
          </Button>
        }
      />
      <TableContainer
        title="Pending review"
        description="Actions are held here until an operator approves or rejects them"
      >
        <EmptyState
          compact
          icon={ShieldCheck}
          title="Nothing to review"
          description="Proposed actions that require sign-off will appear here. Selecting one opens a detail drawer with full context."
        />
      </TableContainer>
    </PageContainer>
  );
}
