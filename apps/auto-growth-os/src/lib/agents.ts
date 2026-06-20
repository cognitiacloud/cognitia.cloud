// lib/agents.ts
// The Cognitia agent roster for the dealership vertical. Deny-by-default:
// an agent may only perform an action listed in allowedActions and not present
// in forbiddenActions. Trust scores are INTERNAL operational demo scores, not
// external certifications.
import type { Agent } from '../types/portal';

/** Actions every agent is forbidden from, regardless of role. */
const UNIVERSAL_FORBIDDEN = [
  'send_without_approval',
  'commit_price',
  'commit_financing',
  'commit_trade_value',
  'commit_warranty',
  'override_human_approval',
];

function agent(a: Omit<Agent, 'forbiddenActions'> & { forbiddenActions: string[] }): Agent {
  return { ...a, forbiddenActions: [...new Set([...UNIVERSAL_FORBIDDEN, ...a.forbiddenActions])] };
}

export const AGENTS: Agent[] = [
  agent({
    id: 'lead-intake',
    name: 'Lead Intake Agent',
    mission: 'Capture and qualify inbound leads with low-risk questions.',
    allowedActions: ['create_lead', 'update_lead_fields', 'ask_qualifying_question', 'draft_reply'],
    forbiddenActions: ['claim_verified_availability'],
    riskBoundary: 'low',
    trustTier: 'assist',
    trustScore: 78,
  }),
  agent({
    id: 'inventory-listing',
    name: 'Inventory Listing Agent',
    mission: 'Draft vehicle titles, descriptions, and SEO metadata.',
    allowedActions: [
      'draft_vehicle_title',
      'draft_vehicle_description',
      'draft_seo_metadata',
      'flag_missing_fields',
    ],
    forbiddenActions: ['publish_unapproved_listing', 'invent_history', 'invent_price'],
    riskBoundary: 'medium',
    trustTier: 'act_with_approval',
    trustScore: 72,
  }),
  agent({
    id: 'sales-draft',
    name: 'Sales Draft Agent',
    mission: 'Draft WhatsApp/SMS/email responses and summarize leads.',
    allowedActions: ['draft_reply', 'summarize_lead', 'recommend_next_step'],
    forbiddenActions: ['final_pricing_claim', 'final_finance_claim'],
    riskBoundary: 'medium',
    trustTier: 'act_with_approval',
    trustScore: 81,
  }),
  agent({
    id: 'seo-geo',
    name: 'SEO / AEO / GEO Agent',
    mission: 'Build search-visibility foundations (structured data, metadata, FAQs).',
    allowedActions: [
      'draft_seo_metadata',
      'draft_faq',
      'draft_city_page',
      'suggest_internal_links',
    ],
    forbiddenActions: ['guarantee_rankings', 'invent_reviews'],
    riskBoundary: 'low',
    trustTier: 'assist',
    trustScore: 70,
  }),
  agent({
    id: 'social-reels',
    name: 'Social / Reels Agent',
    mission: 'Draft captions, reel scripts, and story ideas for review.',
    allowedActions: ['draft_caption', 'draft_reel_script', 'suggest_hashtags'],
    forbiddenActions: ['post_without_approval', 'invent_promotion'],
    riskBoundary: 'medium',
    trustTier: 'act_with_approval',
    trustScore: 68,
  }),
  agent({
    id: 'proof-reporter',
    name: 'Proof Reporter Agent',
    mission: 'Summarize completed work and link proof events into reports.',
    allowedActions: ['summarize_work', 'create_report_draft', 'link_proof_events'],
    forbiddenActions: ['invent_outcomes', 'claim_roi_without_evidence'],
    riskBoundary: 'low',
    trustTier: 'assist',
    trustScore: 84,
  }),
  agent({
    id: 'compliance-guardrail',
    name: 'Compliance Guardrail Agent',
    mission: 'Scan drafts, flag risky claims, and require approval.',
    allowedActions: ['scan_draft', 'flag_risky_claim', 'require_approval', 'suggest_safer_wording'],
    forbiddenActions: ['override_human_approval', 'auto_send'],
    riskBoundary: 'high',
    trustTier: 'observe',
    trustScore: 90,
  }),
  agent({
    id: 'demandara-gtm',
    name: 'Demandara GTM Agent',
    mission: 'Track dealership prospects and structure outreach — never spam.',
    allowedActions: ['create_prospect', 'update_prospect_stage', 'draft_outreach', 'log_activity'],
    forbiddenActions: ['bulk_spam', 'send_without_approval'],
    riskBoundary: 'low',
    trustTier: 'assist',
    trustScore: 74,
  }),
  agent({
    id: 'discovery-strategist',
    name: 'Discovery Strategist Agent',
    mission: 'Run discovery, score readiness, and draft proposals.',
    allowedActions: [
      'score_discovery',
      'recommend_package',
      'draft_proposal',
      'ask_clarifying_question',
    ],
    forbiddenActions: ['commit_pricing', 'promise_outcomes'],
    riskBoundary: 'low',
    trustTier: 'assist',
    trustScore: 79,
  }),
];

const BY_ID = new Map(AGENTS.map((a) => [a.id, a]));

export function getAgent(id: string): Agent | undefined {
  return BY_ID.get(id);
}

/**
 * Deny-by-default permission check: the agent must exist, the action must be in
 * allowedActions, and must NOT be in forbiddenActions (forbidden always wins).
 */
export function canAgentPerform(agentId: string, action: string): boolean {
  const a = BY_ID.get(agentId);
  if (!a) return false;
  if (a.forbiddenActions.includes(action)) return false;
  return a.allowedActions.includes(action);
}
