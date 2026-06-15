import { PageHead, EmptyState, Chip } from '../../../components/ui';

export default function IntegrationsPage() {
  return (
    <>
      <PageHead
        title="Integrations"
        subtitle="Connection health, sync state, and the kill switch."
        action={<Chip tone="neutral">HubSpot · others disabled</Chip>}
      />
      <EmptyState
        icon="integrations"
        title="Integrations view is being wired"
        sub="HubSpot connection status, sync history, and pause/resume already exist in the API. Salesforce, Slack, ads, voice, and calendar are intentionally shown as disabled placeholders until honestly wired."
      />
    </>
  );
}
