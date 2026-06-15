import { PageContainer, PageHeader } from "@/components/shell";
import { Card, CardHeader, Button } from "@/components/ui";

export const metadata = { title: "Settings" };

const SECTIONS = [
  {
    title: "Workspace",
    description: "Name, branding, and operator defaults.",
  },
  {
    title: "Governance",
    description: "Approval thresholds and human-in-the-loop policy.",
  },
  {
    title: "Members & roles",
    description: "Who can operate, approve, and audit.",
  },
  {
    title: "Notifications",
    description: "How and when the operator reaches you.",
  },
];

/**
 * Settings — section scaffold. Lane A provides the layout and section cards;
 * each lane owns the controls inside its respective section.
 */
export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        subtitle="Configure the workspace and governance policy."
      />
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader
              title={section.title}
              description={section.description}
              action={
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              }
            />
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
