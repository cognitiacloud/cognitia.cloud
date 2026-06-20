import { SiteHeader } from '@/components/brand/SiteHeader';
import { DealerWordmark } from '@/components/brand/DealerWordmark';
import { PublicSiteFooter } from '@/components/brand/PublicSiteFooter';
import { PUBLIC_NAV } from '@/lib/routes';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader
        logo={<DealerWordmark />}
        nav={PUBLIC_NAV}
        cta={{ href: '/book-test-drive', label: 'Book Test Drive' }}
      />
      <main className="flex-1">{children}</main>
      <PublicSiteFooter />
    </>
  );
}
