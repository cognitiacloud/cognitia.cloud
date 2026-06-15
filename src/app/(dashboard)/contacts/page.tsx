import { Users, Search, Plus } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell";
import { Button, TableContainer, EmptyState } from "@/components/ui";

export const metadata = { title: "Contacts" };

/**
 * Contacts — the people the operator engages. Lane A provides the frame; the
 * contacts lane supplies the table, search wiring, and a profile drawer.
 */
export default function ContactsPage() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Contacts"
        subtitle="People in the operator's working set."
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Search className="size-3.5" />
              Search
            </Button>
            <Button variant="primary" size="sm">
              <Plus className="size-3.5" />
              Add contact
            </Button>
          </>
        }
      />
      <TableContainer title="All contacts">
        <EmptyState
          compact
          icon={Users}
          title="No contacts yet"
          description="Contacts synced from your integrations or added manually will appear here."
        />
      </TableContainer>
    </PageContainer>
  );
}
