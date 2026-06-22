import { SiteHeader } from '@/components/brand/SiteHeader';
import { CognitiaMark } from '@/components/brand/CognitiaMark';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { SALES_NAV } from '@/lib/routes';

function DemandaraLogo() {
  return (
    <span className="flex items-center gap-2.5">
      <CognitiaMark size={32} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight text-ink-100">
          Demandara
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-700/90">
          × Cognitia
        </span>
      </span>
    </span>
  );
}

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader
        logo={<DemandaraLogo />}
        nav={SALES_NAV}
        cta={{ href: '/discovery', label: 'Start Discovery' }}
        ctaVariant="navy"
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
