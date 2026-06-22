// lib/adapters/types.ts
// Integration contracts. The demo ships Mock* implementations; production swaps
// in real ones behind the same interfaces — no call-site changes required.

import type { AdapterResult, Lead } from '../../types';

export type { AdapterResult };

export interface DateRange {
  from: string;
  to: string;
}

export interface CampaignMetrics {
  channel: 'Google Ads' | 'Meta Ads';
  campaign: string;
  impressions: number;
  clicks: number;
  leads: number;
  spendCad: number;
  costPerLeadCad: number;
}

export interface LeadContext {
  lead: Lead;
  /** Prior messages, most recent last. */
  history: string[];
}

export interface WhatsAppAdapter {
  sendMessage(to: string, body: string, opts?: { templateId?: string }): Promise<AdapterResult>;
}

export interface CrmAdapter {
  upsertLead(lead: Lead): Promise<AdapterResult<{ crmId: string }>>;
  getLead(id: string): Promise<Lead | null>;
  listLeads(): Promise<Lead[]>;
}

export interface AdsReportingAdapter {
  getCampaignMetrics(range: DateRange): Promise<CampaignMetrics[]>;
}

export interface AiAgentAdapter {
  /** Always returns a draft that REQUIRES human approval — autonomy is impossible by type. */
  draftReply(
    ctx: LeadContext,
  ): Promise<{ draft: string; requiresHumanApproval: true; rationale: string }>;
}

export interface MessagingAdapter {
  send(channel: 'email' | 'sms', to: string, body: string): Promise<AdapterResult>;
}

export interface AdapterRegistry {
  whatsapp: WhatsAppAdapter;
  crm: CrmAdapter;
  ads: AdsReportingAdapter;
  ai: AiAgentAdapter;
  messaging: MessagingAdapter;
}
