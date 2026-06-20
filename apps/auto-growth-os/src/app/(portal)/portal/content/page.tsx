import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ContentStudio } from '@/components/portal/ContentStudio';

export const metadata: Metadata = { title: 'Content' };

export default function PortalContentPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Inventory &amp; content"
        title="Content drafts"
        description="Listing descriptions, SEO copy, FAQs, and city pages — risk-scanned and approval-gated."
      />
      <ContentStudio kind="content" />
    </>
  );
}
