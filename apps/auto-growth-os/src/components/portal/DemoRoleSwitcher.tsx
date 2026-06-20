'use client';

// components/portal/DemoRoleSwitcher.tsx
// Switches the demo viewer role. This is a DEMO control only — there is no real
// authentication or authorization in this build.
import { useAppState } from '@/lib/store/useAppState';
import type { RoleId } from '@/types';

const ROLES: { id: RoleId; label: string }[] = [
  { id: 'dealer_owner', label: 'Dealer Owner' },
  { id: 'sales_manager', label: 'Sales Manager' },
  { id: 'salesperson', label: 'Salesperson' },
  { id: 'inventory_manager', label: 'Inventory Manager' },
  { id: 'demandara_operator', label: 'Demandara Operator' },
  { id: 'cognitia_admin', label: 'Cognitia Admin' },
];

export function DemoRoleSwitcher() {
  const { role, setRole } = useAppState();
  return (
    <label className="flex items-center gap-2 text-xs text-ink-400">
      <span className="hidden sm:inline">Demo role</span>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as RoleId)}
        className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink-100 focus:border-cyan-400/50 focus:outline-none"
      >
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
