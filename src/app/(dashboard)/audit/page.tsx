import { ScrollText, Download } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell";
import { Button, TableContainer, EmptyState } from "@/components/ui";

export const metadata = { title: "Audit" };

/**
 * Audit log — the immutable record of governed activity. Lane A provides the
 * frame; the governance lane supplies the event stream and export.
 */
export default function AuditPage() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Audit"
        subtitle="A complete, immutable trail of operator activity."
        actions={
          <Button variant="secondary" size="sm">
            <Download className="size-3.5" />
            Export
          </Button>
        }
      />
      <TableContainer title="Activity log" description="Newest first">
        <EmptyState
          compact
          icon={ScrollText}
          title="No activity recorded"
          description="Every decision, approval, and run is logged here for review and compliance."
        />
      </TableContainer>
    </PageContainer>
  );
}
