// lib/adapters/crm.ts
import type { AdapterResult, Lead } from '../../types';
import type { CrmAdapter } from './types';
import leadsRaw from '../../data/leads.json';

const SEED = leadsRaw as Lead[];

/**
 * Simulated CRM/DMS adapter backed by seed data. Production: implement against a
 * real CRM/DMS (e.g. HubSpot, DealerSocket, VinSolutions) behind this interface.
 */
export class MockCrmAdapter implements CrmAdapter {
  async upsertLead(lead: Lead): Promise<AdapterResult<{ crmId: string }>> {
    console.info('[CRM:SIMULATED] upsertLead', { id: lead.id, stage: lead.stage });
    return {
      ok: true,
      simulated: true,
      detail: `Would upsert lead ${lead.name} into the CRM`,
      data: { crmId: `crm_${lead.id}` },
    };
  }

  async getLead(id: string): Promise<Lead | null> {
    return SEED.find((l) => l.id === id) ?? null;
  }

  async listLeads(): Promise<Lead[]> {
    return SEED;
  }
}
