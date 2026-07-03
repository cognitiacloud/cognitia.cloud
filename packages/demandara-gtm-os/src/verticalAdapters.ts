import type {
  DataMode,
  DemandaraLead,
  DesiredTimeline,
  EvidenceLabel,
  VerticalId,
} from './types.js';

/**
 * Vertical adapters (06_VERTICAL_ADAPTERS_CONTEXT.md).
 *
 * Adapters specialize fields and copy per vertical, but they can never bypass
 * Cognitia gates: consent, source rights, human approval, and proof receipt
 * generation stay mandatory in the workflow engine regardless of adapter.
 *
 * Only Budget Wheels DealerOS is implemented. MoverOS is a reference PATTERN
 * only (PR #30 summary — no source copied); Skillocate and Alpha Investo are
 * design-only descriptors. The engine refuses to run verticals that have no
 * implemented adapter.
 */

export interface VerticalAdapter {
  verticalId: VerticalId;
  displayName: string;
  evidenceLabel: EvidenceLabel;
  /** Data modes this adapter accepts. Never includes 'live_customer' here. */
  allowedDataModes: readonly DataMode[];
  /** Avatar segments this vertical serves; used by qualification scoring. */
  avatarSegments: readonly string[];
  /** Pain/problem categories the vertical playbook addresses. */
  painCategories: readonly string[];
  /** Urgency score (0..1) per declared timeline. */
  urgencyByTimeline: Readonly<Record<DesiredTimeline, number>>;
  /** Trust-gap label per pain category (fallback used when absent). */
  trustGapByPain: Readonly<Record<string, string>>;
  /** Next-step copy per avatar segment (fallback used when absent). */
  nextStepBySegment: Readonly<Record<string, string>>;
  fallbackNextStep: string;
  /** Connector id used for the mock writeback (must be mock_only in registry). */
  mockWritebackConnectorId: string;
  /** Human-readable mock writeback target, e.g. 'mock CRM + appointment desk'. */
  mockWritebackTarget: string;
  proofReceiptTemplateId: string;
  /** Live actions this vertical explicitly blocks in this build. */
  blockedLiveActions: readonly string[];
  /** Metrics contributed to the monthly proof-backed report. */
  monthlyReportMetrics: readonly string[];
}

/** Budget Wheels DealerOS — first proof wedge (08_BUDGET_WHEELS_DEALEROS_CONTEXT.md). */
export const budgetWheelsDealerOsAdapter: VerticalAdapter = {
  verticalId: 'budget_wheels_dealeros',
  displayName: 'Budget Wheels DealerOS (internal demo)',
  evidenceLabel: 'IMPLEMENTED_LOCAL_MOCK',
  allowedDataModes: ['fake_fixture', 'internal_reserved'],
  avatarSegments: [
    'independent_used_car_dealer',
    'dealer_principal',
    'used_car_buyer',
    'bdc_manager',
  ],
  painCategories: [
    'slow_lead_followup',
    'missed_leads',
    'vehicle_trust_gap',
    'manual_bdc_overload',
    'no_owner_accountability_report',
  ],
  urgencyByTimeline: {
    immediate: 0.95,
    this_week: 0.75,
    this_month: 0.5,
    exploring: 0.25,
  },
  trustGapByPain: {
    slow_lead_followup: 'Buyer doubts the dealer will respond before a competitor does.',
    missed_leads: 'Owner cannot prove which leads were dropped or why.',
    vehicle_trust_gap: 'Buyer lacks proof of vehicle condition and history claims.',
    manual_bdc_overload: 'BDC follow-up quality is unverifiable under manual load.',
    no_owner_accountability_report: 'Owner has no proof-backed monthly view of lead outcomes.',
  },
  nextStepBySegment: {
    independent_used_car_dealer:
      'Prepare a proof-backed follow-up plan and request human approval to record a mock CRM writeback.',
    dealer_principal:
      'Draft an owner-level proof summary and request human approval for a mock report writeback.',
    used_car_buyer:
      'Prepare a consented follow-up recommendation with vehicle proof points for human review.',
    bdc_manager:
      'Queue a governed follow-up task recommendation for human approval (mock writeback only).',
  },
  fallbackNextStep: 'Route to human operator for manual review; no automated action.',
  mockWritebackConnectorId: 'crm_mock',
  mockWritebackTarget: 'mock CRM lead record + mock appointment desk intent',
  proofReceiptTemplateId: 'budget_wheels_lead_to_close.v1',
  blockedLiveActions: [
    'live_crm_write',
    'live_tms_write',
    'buyer_outreach',
    'dealer_outreach',
    'inventory_scrape',
    'marketplace_scrape',
    'deployment',
  ],
  monthlyReportMetrics: [
    'qualified_lead_progression',
    'consented_followup_readiness',
    'human_approved_next_steps',
    'proof_receipts_generated',
    'blocked_unsafe_action_count',
    'revenue_opportunity_preserved',
  ],
};

/**
 * Design-only vertical descriptor: enough shape to plan a future adapter,
 * explicitly not runnable.
 */
export interface FutureVerticalDescriptor {
  verticalId: VerticalId;
  displayName: string;
  evidenceLabel: EvidenceLabel;
  status: 'reference_pattern_only' | 'design_only';
  summary: string;
}

/**
 * MoverOS PR #30 is an external reference PATTERN (07_MOVEROS_PR30_REFERENCE_SUMMARY.md):
 * adapter routes, mock-first tools, proof adapter contract, connector registry
 * shape, tenant-zero fixtures, dormant agent-economy primitives. No MoverOS
 * source exists in this repository.
 */
export const moverOsReferencePattern: FutureVerticalDescriptor = {
  verticalId: 'moveros_reference',
  displayName: 'MoverOS (external reference pattern only)',
  evidenceLabel: 'DOC_ONLY',
  status: 'reference_pattern_only',
  summary:
    'Moving-company vertical OS pattern: website/funnel surfaces, mock-first agent tools, adapter routes, proof adapter, connector registry, tenant-zero fixtures. Pattern adopted, code not copied.',
};

export const skillocateDescriptor: FutureVerticalDescriptor = {
  verticalId: 'skillocate',
  displayName: 'Skillocate (future vertical)',
  evidenceLabel: 'DESIGN_ONLY',
  status: 'design_only',
  summary:
    'BC education/grants/assessment-help vertical. Future adapter; no fixtures, no workflow runs in this build.',
};

export const alphaInvestoDescriptor: FutureVerticalDescriptor = {
  verticalId: 'alpha_investo',
  displayName: 'Alpha Investo (parked, claim-sensitive)',
  evidenceLabel: 'DESIGN_ONLY',
  status: 'design_only',
  summary:
    'Finance/media/subscription/analytics vertical. Parked and claim-sensitive; no adapter, no fixtures, no workflow runs in this build.',
};

const IMPLEMENTED_ADAPTERS: ReadonlyMap<VerticalId, VerticalAdapter> = new Map([
  [budgetWheelsDealerOsAdapter.verticalId, budgetWheelsDealerOsAdapter],
]);

export const FUTURE_VERTICALS: readonly FutureVerticalDescriptor[] = [
  moverOsReferencePattern,
  skillocateDescriptor,
  alphaInvestoDescriptor,
];

/** Only implemented adapters run; reference/design-only verticals return undefined. */
export function getVerticalAdapter(vertical: VerticalId): VerticalAdapter | undefined {
  return IMPLEMENTED_ADAPTERS.get(vertical);
}

/** Whether the adapter accepts the lead's data mode (defense in depth on top of intake). */
export function adapterAllowsDataMode(adapter: VerticalAdapter, lead: DemandaraLead): boolean {
  return adapter.allowedDataModes.includes(lead.dataMode);
}
