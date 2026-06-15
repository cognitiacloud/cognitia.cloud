import { PageHead, EmptyState } from '../../../components/ui';

export default function ContactsPage() {
  return (
    <>
      <PageHead title="Contacts" subtitle="Accounts, outreach history, and CRM sync state." />
      <EmptyState
        icon="contacts"
        title="Contacts view is being wired"
        sub="Backed by the accounts/opportunities API. Contact detail, activity timeline, and CRM sync state land with the meeting loop slice."
      />
    </>
  );
}
