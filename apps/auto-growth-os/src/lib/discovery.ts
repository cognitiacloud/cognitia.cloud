// lib/discovery.ts
// Auto Growth OS Discovery Console — questionnaire schema, readiness/complexity
// scoring (weights transcribed from the spec), package recommendation, and the
// structured proposal output. Pure + deterministic so it is fully testable.
import type {
  DiscoveryAnswers,
  DiscoveryAnswerValue,
  DiscoveryPackage,
  DiscoveryScores,
} from '../types';

/* ----------------------------------------------------------------------------
 * Questionnaire schema (12 sections)
 * --------------------------------------------------------------------------*/
export interface DiscoveryOption {
  value: string;
  label: string;
}
export interface DiscoveryQuestion {
  id: string;
  label: string;
  type: 'single' | 'multi' | 'text';
  options?: DiscoveryOption[];
  help?: string;
}
export interface DiscoverySectionDef {
  id: string;
  title: string;
  questions: DiscoveryQuestion[];
}

const ACCESS_OPTIONS: DiscoveryOption[] = [
  { value: 'website', label: 'Website exists / access' },
  { value: 'domain', label: 'Domain / DNS access' },
  { value: 'hosting', label: 'Hosting / platform access' },
  { value: 'gbp', label: 'Google Business Profile access' },
  { value: 'analytics', label: 'Analytics installed / access' },
  { value: 'search_console', label: 'Search Console access' },
  { value: 'meta', label: 'Meta Business access' },
  { value: 'tiktok', label: 'TikTok Business access' },
  { value: 'whatsapp', label: 'WhatsApp Business access' },
  { value: 'crm', label: 'CRM / spreadsheet exists' },
  { value: 'inventory_feed', label: 'Inventory feed / structured process' },
];

export const DISCOVERY_SECTIONS: DiscoverySectionDef[] = [
  {
    id: 'identity',
    title: 'Client Identity',
    questions: [
      { id: 'dealership', label: 'Dealership / business name', type: 'text' },
      { id: 'city', label: 'Primary city', type: 'text' },
      {
        id: 'businessType',
        label: 'Business type',
        type: 'single',
        options: [
          { value: 'dealership', label: 'Used-car dealership' },
          { value: 'finance_focused', label: 'Finance-focused dealer' },
          { value: 'lead_generation', label: 'Lead-generation business' },
          { value: 'broker', label: 'Auto broker' },
          { value: 'marketplace', label: 'Marketplace / multi-dealer' },
          { value: 'ad_platform', label: 'Dealer advertising platform' },
        ],
      },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Current Infrastructure',
    questions: [
      {
        id: 'access',
        label: 'What access / assets exist today?',
        type: 'multi',
        options: ACCESS_OPTIONS,
        help: 'Drives the Infrastructure Readiness score.',
      },
    ],
  },
  {
    id: 'brand',
    title: 'Brand / Visual Direction',
    questions: [
      {
        id: 'brandDirection',
        label: 'Visual direction',
        type: 'single',
        options: [
          { value: 'clean', label: 'Clean / modern' },
          { value: 'premium', label: 'Premium / executive' },
          { value: 'bold', label: 'Bold / high-energy' },
          { value: 'undecided', label: 'Not sure yet' },
        ],
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Workflow',
    questions: [
      {
        id: 'inventoryModel',
        label: 'Inventory model',
        type: 'single',
        options: [
          { value: 'owned', label: 'Owned inventory' },
          { value: 'partner', label: 'Partner-dealer inventory' },
          { value: 'marketplace', label: 'Marketplace listings' },
          { value: 'mixed', label: 'Mixed' },
        ],
      },
      {
        id: 'inventoryWorkflow',
        label: 'How is inventory posted today?',
        type: 'single',
        options: [
          { value: 'manual', label: 'Manual form entry' },
          { value: 'spreadsheet', label: 'Spreadsheet' },
          { value: 'whatsapp', label: 'WhatsApp / Telegram' },
          { value: 'dealer_media', label: 'Dealer media / photos' },
          { value: 'feed_api', label: 'Dealer feed / API' },
        ],
      },
    ],
  },
  {
    id: 'lead_capture',
    title: 'Lead Capture',
    questions: [
      {
        id: 'leadRouting',
        label: 'How are leads routed?',
        type: 'single',
        options: [
          { value: 'single', label: 'Single recipient' },
          { value: 'multiple_internal', label: 'Multiple internal staff' },
          { value: 'partner_routing', label: 'Partner-dealer routing' },
          { value: 'ai_first', label: 'AI closer first, human second' },
        ],
      },
    ],
  },
  {
    id: 'ai_closer',
    title: 'AI Sales Closer',
    questions: [
      {
        id: 'aiLevel',
        label: 'Desired AI assistance level',
        type: 'single',
        options: [
          { value: 'none', label: 'None' },
          { value: 'draft_only', label: 'Draft only' },
          { value: 'human_approved', label: 'Human-approved send' },
          { value: 'low_risk_auto', label: 'Low-risk auto-reply' },
          { value: 'appointment_only', label: 'Appointment-only automation' },
          { value: 'full_queue', label: 'Full queue with approval gates' },
        ],
      },
    ],
  },
  {
    id: 'conversation',
    title: 'Sales Conversation Intelligence',
    questions: [
      {
        id: 'conversationDepth',
        label: 'How structured are sales conversations?',
        type: 'single',
        options: [
          { value: 'adhoc', label: 'Ad-hoc' },
          { value: 'scripted', label: 'Lightly scripted' },
          { value: 'structured', label: 'Structured intake + qualification' },
        ],
      },
    ],
  },
  {
    id: 'website_seo',
    title: 'Website / SEO / AEO / GEO / IEO',
    questions: [
      {
        id: 'websiteFeatures',
        label: 'Which page types do you need?',
        type: 'multi',
        options: [
          { value: 'basic', label: 'Basic site' },
          { value: 'city_pages', label: 'City pages' },
          { value: 'finance_pages', label: 'Finance pages' },
          { value: 'trade_in_pages', label: 'Trade-in pages' },
          { value: 'comparison_pages', label: 'Comparison pages' },
          { value: 'dealer_landing', label: 'Dealer landing pages' },
          { value: 'structured_data', label: 'Structured data' },
        ],
      },
    ],
  },
  {
    id: 'social',
    title: 'Social / Reels Automation',
    questions: [
      {
        id: 'socialLevel',
        label: 'Social content approach',
        type: 'single',
        options: [
          { value: 'manual', label: 'Manual posting' },
          { value: 'captions_scripts', label: 'Captions / scripts' },
          { value: 'reels', label: 'Reels workflow' },
          { value: 'multi_platform', label: 'Multi-platform' },
        ],
      },
    ],
  },
  {
    id: 'ads',
    title: 'Advertising Strategy',
    questions: [
      {
        id: 'adsLevel',
        label: 'Advertising scope',
        type: 'single',
        options: [
          { value: 'none', label: 'None yet' },
          { value: 'single', label: 'Single channel' },
          { value: 'multi', label: 'Multi-channel' },
          { value: 'finance_campaigns', label: 'Finance / application campaigns' },
        ],
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing / Package Fit',
    questions: [
      {
        id: 'budgetBand',
        label: 'Investment comfort',
        type: 'single',
        options: [
          { value: 'starter', label: 'Starter' },
          { value: 'growth', label: 'Growth' },
          { value: 'premium', label: 'Premium' },
          { value: 'enterprise', label: 'Enterprise' },
        ],
      },
    ],
  },
  {
    id: 'output',
    title: 'Output Generator',
    questions: [
      {
        id: 'urgency',
        label: 'Timeline',
        type: 'single',
        options: [
          { value: 'exploring', label: 'Exploring' },
          { value: 'this_quarter', label: 'This quarter' },
          { value: 'asap', label: 'As soon as possible' },
        ],
      },
    ],
  },
];

/* ----------------------------------------------------------------------------
 * Weights (transcribed from spec §18)
 * --------------------------------------------------------------------------*/
const INFRA_POINTS: Record<string, number> = {
  website: 10,
  domain: 15,
  hosting: 10,
  gbp: 10,
  analytics: 10,
  search_console: 10,
  meta: 5,
  tiktok: 5,
  whatsapp: 5,
  crm: 10,
  inventory_feed: 10,
};
const BUSINESS_TYPE_POINTS: Record<string, number> = {
  dealership: 10,
  finance_focused: 15,
  lead_generation: 20,
  broker: 20,
  marketplace: 25,
  ad_platform: 25,
};
const INVENTORY_POINTS: Record<string, number> = {
  owned: 5,
  partner: 20,
  marketplace: 25,
  mixed: 25,
};
const WORKFLOW_POINTS: Record<string, number> = {
  manual: 5,
  spreadsheet: 10,
  whatsapp: 15,
  dealer_media: 10,
  feed_api: 25,
};
const ROUTING_POINTS: Record<string, number> = {
  single: 5,
  multiple_internal: 10,
  partner_routing: 20,
  ai_first: 20,
};
const AI_POINTS: Record<string, number> = {
  none: 0,
  draft_only: 5,
  human_approved: 10,
  low_risk_auto: 15,
  appointment_only: 15,
  full_queue: 25,
};
const WEBSITE_POINTS: Record<string, number> = {
  basic: 5,
  city_pages: 10,
  finance_pages: 10,
  trade_in_pages: 10,
  comparison_pages: 10,
  dealer_landing: 15,
  structured_data: 10,
};
const SOCIAL_POINTS: Record<string, number> = {
  manual: 5,
  captions_scripts: 10,
  reels: 10,
  multi_platform: 15,
};
const ADS_POINTS: Record<string, number> = { none: 0, single: 5, multi: 15, finance_campaigns: 15 };

/* ----------------------------------------------------------------------------
 * Answer accessors
 * --------------------------------------------------------------------------*/
function str(a: DiscoveryAnswers, k: string): string {
  const v = a[k];
  return typeof v === 'string' ? v : '';
}
function arr(a: DiscoveryAnswers, k: string): string[] {
  const v = a[k];
  return Array.isArray(v) ? v : [];
}
function pts(map: Record<string, number>, key: string): number {
  return map[key] ?? 0;
}
function sumPts(map: Record<string, number>, keys: string[]): number {
  return keys.reduce((sum, k) => sum + (map[k] ?? 0), 0);
}

/* ----------------------------------------------------------------------------
 * Scoring
 * --------------------------------------------------------------------------*/
export function scoreDiscovery(answers: DiscoveryAnswers): DiscoveryScores {
  const access = arr(answers, 'access');
  const inventoryModel = str(answers, 'inventoryModel');
  const workflow = str(answers, 'inventoryWorkflow');
  const routing = str(answers, 'leadRouting');
  const aiLevel = str(answers, 'aiLevel');
  const adsLevel = str(answers, 'adsLevel');
  const websiteFeatures = arr(answers, 'websiteFeatures');
  const socialLevel = str(answers, 'socialLevel');
  const businessType = str(answers, 'businessType');

  const infrastructureReadiness = Math.min(100, sumPts(INFRA_POINTS, access));

  const complexity =
    pts(BUSINESS_TYPE_POINTS, businessType) +
    pts(INVENTORY_POINTS, inventoryModel) +
    pts(WORKFLOW_POINTS, workflow) +
    pts(ROUTING_POINTS, routing);

  const automation = pts(AI_POINTS, aiLevel) + pts(ADS_POINTS, adsLevel);

  const contentBurden = sumPts(WEBSITE_POINTS, websiteFeatures) + pts(SOCIAL_POINTS, socialLevel);

  const integrationBurden =
    (['partner', 'marketplace', 'mixed'].includes(inventoryModel) ? 20 : 0) +
    (routing === 'partner_routing' ? 15 : 0) +
    (workflow === 'feed_api' ? 15 : 0) +
    (access.includes('crm') ? 10 : 0);

  const complianceRisk =
    (['low_risk_auto', 'full_queue'].includes(aiLevel) ? 15 : 0) +
    (adsLevel === 'finance_campaigns' ? 10 : 0) +
    (businessType === 'finance_focused' ? 15 : 0) +
    (['partner', 'marketplace'].includes(inventoryModel) ? 10 : 0);

  const urgency =
    str(answers, 'urgency') === 'asap' ? 25 : str(answers, 'urgency') === 'this_quarter' ? 15 : 5;

  return {
    infrastructureReadiness,
    complexity,
    automation,
    contentBurden,
    integrationBurden,
    complianceRisk,
    urgency,
  };
}

/* ----------------------------------------------------------------------------
 * Package recommendation (boundaries from spec §18)
 * --------------------------------------------------------------------------*/
export function recommendDiscoveryPackage(
  scores: DiscoveryScores,
  answers?: DiscoveryAnswers,
): DiscoveryPackage {
  const { complexity, automation } = scores;
  const inventoryModel = answers ? str(answers, 'inventoryModel') : '';
  const routing = answers ? str(answers, 'leadRouting') : '';
  const aiLevel = answers ? str(answers, 'aiLevel') : '';
  const workflow = answers ? str(answers, 'inventoryWorkflow') : '';
  const access = answers ? arr(answers, 'access') : [];
  const websiteFeatures = answers ? arr(answers, 'websiteFeatures') : [];
  const socialLevel = answers ? str(answers, 'socialLevel') : '';

  const isMarketplace = inventoryModel === 'marketplace' || routing === 'partner_routing';
  const apiRouting = workflow === 'feed_api' && routing === 'partner_routing';
  const hasAiCloser = aiLevel !== '' && aiLevel !== 'none';
  const inventoryAutomation = workflow === 'feed_api';
  const crmSelected = access.includes('crm');
  const crmOrSocialOrSeo =
    crmSelected || socialLevel !== '' || websiteFeatures.some((f) => f !== 'basic');

  // Enterprise / Marketplace
  if (complexity >= 86 || isMarketplace || apiRouting) return 'Enterprise / Marketplace';
  // Full Auto Growth OS
  if (complexity >= 61 || automation >= 51 || (inventoryAutomation && hasAiCloser && crmSelected)) {
    return 'Full Auto Growth OS';
  }
  // Growth Engine
  if (complexity >= 36 || automation >= 26 || crmOrSocialOrSeo) return 'Growth Engine';
  // Foundation
  return 'Foundation Website';
}

/* ----------------------------------------------------------------------------
 * Structured output (16 sections)
 * --------------------------------------------------------------------------*/
const PACKAGE_PRICING: Record<DiscoveryPackage, string> = {
  'Foundation Website': 'Setup $6k–$12k CAD · $900–$1,800/mo (indicative; confirmed in proposal)',
  'Growth Engine': 'Setup $12k–$28k CAD · $2.5k–$6k/mo (indicative; confirmed in proposal)',
  'Full Auto Growth OS': 'Setup $35k–$85k CAD · $9k–$20k/mo (indicative; confirmed in proposal)',
  'Enterprise / Marketplace': 'Custom scope — estimated after a technical discovery session',
};

const PACKAGE_SYSTEM: Record<DiscoveryPackage, string[]> = {
  'Foundation Website': [
    'Public dealership website',
    'Structured lead capture',
    'CRM-lite pipeline',
  ],
  'Growth Engine': [
    'Website + lead capture',
    'CRM-lite',
    'Social / SEO foundations',
    'Appointment setting',
  ],
  'Full Auto Growth OS': [
    'Inventory automation',
    'CRM-lite + AI-assisted follow-up (human-approved)',
    'Proof reporting',
    'Demandara growth operations',
  ],
  'Enterprise / Marketplace': [
    'Multi-dealer marketplace',
    'Dealer portal + partner routing',
    'API / feed integrations',
    'Governance + proof at scale',
  ],
};

export interface DiscoveryOutput {
  clientUnderstanding: string;
  whatWeHeard: string[];
  clarificationQuestions: string[];
  proposedSystem: string[];
  recommendedPackage: DiscoveryPackage;
  optionalAddOns: string[];
  roadmap: { d30: string[]; d60: string[]; d90: string[] };
  accessChecklist: string[];
  clientResponsibilities: string[];
  demandaraResponsibilities: string[];
  cognitiaResponsibilities: string[];
  riskNotes: string[];
  pricingRange: string;
  proposalOutline: string[];
  proofCapturePlan: string[];
  finalConfirmation: string;
  scores: DiscoveryScores;
}

export function generateDiscoveryOutput(answers: DiscoveryAnswers): DiscoveryOutput {
  const scores = scoreDiscovery(answers);
  const pkg = recommendDiscoveryPackage(scores, answers);
  const dealership = str(answers, 'dealership') || 'the dealership';
  const city = str(answers, 'city') || 'your market';

  const have = arr(answers, 'access');
  const missing = ACCESS_OPTIONS.filter((o) => !have.includes(o.value)).map((o) => o.label);

  const whatWeHeard = [
    `Business type: ${str(answers, 'businessType') || 'not specified'}.`,
    `Inventory model: ${str(answers, 'inventoryModel') || 'not specified'} via ${str(answers, 'inventoryWorkflow') || 'an unspecified workflow'}.`,
    `Lead routing: ${str(answers, 'leadRouting') || 'not specified'}.`,
    `AI assistance: ${str(answers, 'aiLevel') || 'none'}; advertising: ${str(answers, 'adsLevel') || 'none'}.`,
    `Timeline: ${str(answers, 'urgency') || 'exploring'}.`,
  ];

  return {
    clientUnderstanding: `${dealership} (${city}) is best served by the ${pkg}. Readiness ${scores.infrastructureReadiness}/100, complexity ${scores.complexity}, automation ${scores.automation}.`,
    whatWeHeard,
    clarificationQuestions: [
      'Who is the single decision-maker and approver for sensitive claims?',
      'Which integrations require access, and who grants it after scope lock?',
      'What does a "win" look like in 90 days that we can measure?',
    ],
    proposedSystem: PACKAGE_SYSTEM[pkg],
    recommendedPackage: pkg,
    optionalAddOns: [
      'WhatsApp/SMS conversation automation (human-approved)',
      'Reels / social content workflow',
      'City + comparison SEO page program',
      'Proof-backed monthly reporting',
    ],
    roadmap: {
      d30: [
        'Scope lock + access checklist',
        'Public site + inventory + lead capture live',
        'CRM-lite pipeline configured',
      ],
      d60: [
        'AI-assisted follow-up with approval gates',
        'Content/social drafts in review',
        'SEO foundations + structured data',
      ],
      d90: [
        'Proof-backed reporting cadence',
        'Optimization based on captured outcomes',
        'Expansion review',
      ],
    },
    accessChecklist: missing.length ? missing : ['All core access already available'],
    clientResponsibilities: [
      'Own and pay ad spend directly in your accounts',
      'Confirm price, availability, financing, warranty, and trade-in details',
      'Approve sensitive AI drafts before they send',
    ],
    demandaraResponsibilities: [
      'Operate the growth workflow and content production',
      'Configure pipelines, pages, and reporting',
      'Run discovery, onboarding, and optimization',
    ],
    cognitiaResponsibilities: [
      'Provide CRM-lite, proof registry, and action ledger',
      'Enforce human-approval gates and agent governance',
      'Maintain consent-aware automation infrastructure',
    ],
    riskNotes: [
      'No guarantees of sales, leads, ROI, rankings, or financing approvals.',
      'Sensitive claims require human approval.',
      'Integrations connect only after access is approved at scope lock.',
    ],
    pricingRange: PACKAGE_PRICING[pkg],
    proposalOutline: [
      'Executive summary',
      'Recommended package + rationale',
      'Scope + modules',
      '30/60/90 roadmap',
      'Responsibilities + access checklist',
      'Investment range + proof plan',
    ],
    proofCapturePlan: [
      'Lead capture + response-time proof events',
      'Approval decisions logged to the action ledger',
      'Inventory publish + content approval proof',
      'Monthly proof-backed report',
    ],
    finalConfirmation: 'Before we build, please confirm: Is this what you meant?',
    scores,
  };
}

/** Convenience used by the GTM prospect seed/UI. */
export function quickRecommend(answers: DiscoveryAnswers): DiscoveryPackage {
  return recommendDiscoveryPackage(scoreDiscovery(answers), answers);
}

export type { DiscoveryAnswers, DiscoveryAnswerValue };
