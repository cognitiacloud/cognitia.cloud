import { PageHead, EmptyState } from '../../../components/ui';

export default function SettingsPage() {
  return (
    <>
      <PageHead title="Settings" subtitle="Session, environment, and operator preferences." />
      <EmptyState
        icon="settings"
        title="Settings are minimal in the pilot"
        sub="The console reads NEXT_PUBLIC_API_URL and derives tenant + role from the signed session. Per-operator preferences are deferred until the pilot needs them."
      />
    </>
  );
}
