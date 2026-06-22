import type { Tenant, TenantId } from '../types.js';

/**
 * The only tenants that exist in v0. All are internal or demo, all mock-mode,
 * and all permit only the two inert mock channels. There is no production tenant
 * and no live channel.
 */
export const TENANTS: Record<TenantId, Tenant> = {
  demandara_internal: {
    id: 'demandara_internal',
    displayName: 'Demandara (internal)',
    internal: true,
    mode: 'mock',
    active: true,
    permittedChannels: ['mock_appointment', 'mock_crm'],
  },
  cognitia_internal: {
    id: 'cognitia_internal',
    displayName: 'Cognitia (internal)',
    internal: true,
    mode: 'mock',
    active: true,
    permittedChannels: ['mock_appointment', 'mock_crm'],
  },
  budget_wheels_demo: {
    id: 'budget_wheels_demo',
    displayName: 'Budget Wheels (demo dealership)',
    internal: true,
    mode: 'mock',
    active: true,
    permittedChannels: ['mock_appointment', 'mock_crm'],
  },
};

export const TENANT_IDS = Object.keys(TENANTS) as TenantId[];

export function getTenant(id: TenantId): Tenant {
  return TENANTS[id];
}
