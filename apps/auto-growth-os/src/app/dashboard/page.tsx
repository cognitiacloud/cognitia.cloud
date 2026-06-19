import type { Metadata } from 'next';
import { Section } from '@/components/ui/Section';
import { DashboardView } from '@/components/dashboard/DashboardView';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'Admin command center — KPIs, the live lead pipeline, source attribution, and recommended next actions.',
};

export default function DashboardPage() {
  return (
    <div className="py-10 sm:py-14">
      <Section>
        <DashboardView />
      </Section>
    </div>
  );
}
