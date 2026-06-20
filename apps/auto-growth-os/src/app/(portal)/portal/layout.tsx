import type { Metadata } from 'next';
import { PortalShell } from '@/components/portal/PortalShell';

export const metadata: Metadata = {
  title: { default: 'Operating Portal', template: '%s · Auto Growth OS Portal' },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
