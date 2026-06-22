import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ContentStudio } from '@/components/portal/ContentStudio';

export const metadata: Metadata = { title: 'Social' };

export default function PortalSocialPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Inventory &amp; content"
        title="Social &amp; reels"
        description="Captions and reel scripts per vehicle. Posts with sensitive claims require approval before publishing."
      />
      <ContentStudio kind="social" />
    </>
  );
}
