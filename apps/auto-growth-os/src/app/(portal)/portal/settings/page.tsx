import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { Badge } from '@/components/ui/Badge';
import { IntegrationsChecklist } from '@/components/portal/IntegrationsChecklist';
import { DISCLAIMERS } from '@/lib/copy';
import type { Tenant, User } from '@/types';
import tenantRaw from '@/data/tenant.json';

const DATA = tenantRaw as { tenant: Tenant; users: User[] };

const ROLE_LABEL: Record<string, string> = {
  cognitia_admin: 'Cognitia Admin',
  demandara_operator: 'Demandara Operator',
  dealer_owner: 'Dealer Owner',
  sales_manager: 'Sales Manager',
  salesperson: 'Salesperson',
  inventory_manager: 'Inventory Manager',
  viewer: 'Viewer',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="font-display text-sm font-semibold text-ink-100">{title}</p>
      <div className="mt-3 text-sm text-ink-400">{children}</div>
    </div>
  );
}

export const metadata: Metadata = { title: 'Settings' };

export default function PortalSettingsPage() {
  const { tenant, users } = DATA;
  return (
    <>
      <PortalPageHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Tenant, roles, integrations, AI autonomy, and compliance text. Demo only — no real auth."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Tenant">
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Business</dt>
              <dd className="text-ink-200">{tenant.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Type</dt>
              <dd className="text-ink-200">{tenant.businessType}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Primary city</dt>
              <dd className="text-ink-200">{tenant.primaryCity}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Domain</dt>
              <dd className="text-ink-200">{tenant.websiteDomain}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Roles &amp; users (demo)">
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3">
                <span className="text-ink-200">{u.name}</span>
                <Badge tone="neutral">{ROLE_LABEL[u.role] ?? u.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Integrations checklist">
          <IntegrationsChecklist />
          <p className="mt-3 text-xs text-ink-500">
            CRM, DMS, and WhatsApp integrations connect only after access is approved at scope lock.
          </p>
        </Card>

        <Card title="AI autonomy &amp; approval rules">
          <ul className="space-y-2">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-200">Autonomy level</span>
              <Badge tone="cyan">Draft + human approval</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-200">Sensitive claims</span>
              <Badge tone="alert">Always require approval</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-200">Autonomous send</span>
              <Badge tone="neutral">Disabled</Badge>
            </li>
          </ul>
        </Card>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          Compliance text
        </p>
        <p className="mt-2 text-sm text-ink-400">{DISCLAIMERS.confirmDetails}</p>
        <p className="mt-1.5 text-sm text-ink-400">{DISCLAIMERS.noGuarantees}</p>
        <p className="mt-1.5 text-sm text-ink-400">{DISCLAIMERS.humanApproval}</p>
      </div>
    </>
  );
}
