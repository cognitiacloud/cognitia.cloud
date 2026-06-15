import { Plug } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell";
import { Card, CardHeader, Button, Badge } from "@/components/ui";

export const metadata = { title: "Integrations" };

/**
 * Integrations — connection catalog. Lane A renders the card grid and status
 * chrome ONLY. Connect/disconnect logic and live status belong to the
 * integrations lane, which should swap the placeholder list for real providers.
 */
const PLACEHOLDER_SLOTS = [
  "CRM",
  "Email",
  "Calendar",
  "Meetings",
  "Data warehouse",
  "Messaging",
];

export default function IntegrationsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Integrations"
        subtitle="Connect the systems the operator works across."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_SLOTS.map((slot) => (
          <Card key={slot} className="flex flex-col">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-md bg-surface-raised text-faint">
                    <Plug className="size-4" strokeWidth={1.85} />
                  </span>
                  {slot}
                </span>
              }
              action={<Badge tone="neutral">Not connected</Badge>}
            />
            <p className="mt-3 flex-1 text-xs leading-relaxed text-muted">
              Placeholder slot. The integrations lane provides the provider,
              status, and connection flow.
            </p>
            <Button variant="secondary" size="sm" className="mt-4 self-start" disabled>
              Connect
            </Button>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
