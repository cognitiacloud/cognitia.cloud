// types/index.ts
// Single source of truth for the Cognitia Auto Growth OS domain model.
// Components and lib/* import their types from here only.
import type { ClaimType, RiskLevel } from '../lib/guardrails';

export type Range = { min: number; max: number };

/* ----------------------------------------------------------------------------
 * Inventory
 * --------------------------------------------------------------------------*/
export type VehicleStatus = 'Available' | 'Reserved' | 'In Transit';

/** Inventory workflow statuses (portal). */
export type AvailabilityStatus = 'available' | 'reserved' | 'sold' | 'in_transit';
export type ApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
export type PublishedStatus = 'unpublished' | 'published';
export type AccidentHistory = 'none' | 'minor' | 'major' | 'unknown';

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  priceCad: number;
  odometerKm: number;
  bodyType: string;
  fuelType: string;
  transmission: string;
  drivetrain: string;
  exteriorColor: string;
  /** Tailwind-friendly gradient stops used to render the card art (no photos). */
  accent: [string, string];
  badges: string[];
  status: VehicleStatus;

  /* Inventory workflow (optional — portal-managed; public pages tolerate absence) */
  vin?: string;
  stockNumber?: string;
  /** URL slug for the public detail page, e.g. "2021-toyota-rav4-xle-awd-v2". */
  slug?: string;
  /** Photo URLs/keys; the demo falls back to the accent gradient art. */
  photos?: string[];
  accidentHistory?: AccidentHistory;
  carfaxAvailable?: boolean;
  warranty?: string;
  availabilityStatus?: AvailabilityStatus;
  approvalStatus?: ApprovalStatus;
  publishedStatus?: PublishedStatus;
  /** Human attestation that sensitive fields (price/accident/warranty) are confirmed. */
  sensitiveFieldsConfirmed?: boolean;
  tenantId?: string;
  dealerName?: string;
  dealerLocation?: string;
  interiorColor?: string;
  videos?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/* ----------------------------------------------------------------------------
 * Leads + scoring
 * --------------------------------------------------------------------------*/
export type LeadSource =
  | 'Website'
  | 'Google Ads'
  | 'Meta Ads'
  | 'WhatsApp'
  | 'Marketplace'
  | 'Referral'
  | 'Walk-in'
  | 'Phone';

export type Stage = 'Nurture' | 'Qualified' | 'Hot Lead' | 'Immediate Sales Handoff';

export type ConsentChannel = 'email' | 'sms' | 'whatsapp';

export interface ConsentRecord {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  /** CASL: when express consent was captured. */
  capturedAt: string | null;
  basis: 'express' | 'implied' | 'none';
}

/** The six weighted signals that drive the lead score. */
export interface ScoringSignals {
  appointmentRequested: boolean; // +25
  financingRequested: boolean; // +20
  tradeInMentioned: boolean; // +20
  budgetProvided: boolean; // +15
  respondToday: boolean; // +10
  specificVehicleSelected: boolean; // +10
}

export interface Lead {
  id: string;
  /** Linked customer (set when a lead is captured or matched). */
  customerId?: string | null;
  name: string;
  email: string;
  phone: string;
  source: LeadSource;
  vehicleInterest: string;
  vehicleId: string | null;
  budgetCad: number | null;
  message: string;
  signals: ScoringSignals;
  score: number;
  stage: Stage;
  owner: string;
  nextAction: string;
  consent: ConsentRecord;
  /** Minutes to first human response; null = not yet contacted. */
  firstResponseMinutes: number | null;
  createdAt: string;
  /** True for leads created during the demo via the landing form. */
  isDemo?: boolean;
}

/** Shape collected by the public LeadForm before scoring. */
export interface LeadFormInput {
  name: string;
  email: string;
  phone: string;
  vehicleId: string | null;
  vehicleInterest: string;
  budgetCad: number | null;
  message: string;
  appointmentRequested: boolean;
  financingRequested: boolean;
  tradeInMentioned: boolean;
  respondToday: boolean;
  consent: { email: boolean; sms: boolean; whatsapp: boolean };
  source?: LeadSource;
}

/* ----------------------------------------------------------------------------
 * Customer Mapper (customer memory)
 * --------------------------------------------------------------------------*/
export type TimelineKind =
  | 'inquiry'
  | 'test-drive'
  | 'purchase'
  | 'service'
  | 'rapport'
  | 'repurchase';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  label: string;
  date: string;
  detail: string;
}

export interface Customer {
  id: string;
  name: string;
  vehicle: string;
  preferredChannel: ConsentChannel;
  familyNote: string;
  preferences: string[];
  lastConcern: string;
  nextAction: string;
  loyaltyMonths: number;
  consent: ConsentRecord;
  timeline: TimelineEvent[];
  /** Optional contact fields (set when a customer is created from a captured lead). */
  email?: string;
  phone?: string;
  location?: string;
  /** True for customers created during the demo from a lead. */
  isDemo?: boolean;
}

/* ----------------------------------------------------------------------------
 * Modules + packages (pricing)
 * --------------------------------------------------------------------------*/
export interface Module {
  id: string;
  name: string;
  category: string;
  whatItDoes: string;
  setupCad: Range;
  monthlyCad: Range;
  passThrough: string;
  delivery: string;
  /** Short icon key rendered by the ModuleCard. */
  icon: string;
}

export type PackageTier = 'Pilot' | 'Growth' | 'Empire';

export interface Package {
  tier: PackageTier;
  name: string;
  tagline: string;
  bestFor: string;
  setupCad: Range;
  monthlyCad: Range;
  /** Module ids included in this package. */
  moduleIds: string[];
  includedModules: string[];
  passThroughCosts: string[];
  launchTimeline: string;
  highlights: string[];
}

/* ----------------------------------------------------------------------------
 * Intake questionnaire + recommendation engine
 * --------------------------------------------------------------------------*/
export type BudgetBand = 'Starter' | 'Growth' | 'Premium' | 'Enterprise';
export type AdBudgetBand = 'Under $1k' | '$1k–$3k' | '$3k–$7k' | '$7k+';
export type ResponseTarget = 'Under 5 minutes' | 'Under 30 minutes' | 'Within 1 hour' | 'Same day';
export type RetentionMaturity =
  | 'No structured retention'
  | 'Some manual reminders'
  | 'Established retention program';

export interface IntakeAnswers {
  // 1. Current website and hosting
  currentWebsite: string;
  hosting: string;
  // 2. Inventory source / posting workflow
  inventoryWorkflow: string;
  // 3. Current CRM / DMS
  crmDms: string;
  // 4. Top 3 lead sources
  topLeadSources: LeadSource[];
  // 5. Monthly ad budget
  monthlyAdBudget: AdBudgetBand;
  // 6. Response-time target
  responseTarget: ResponseTarget;
  // 7. Financing / trade-in process
  financingTradeIn: string;
  // 8. WhatsApp / SMS / email consent process
  consentProcess: string;
  // 9. Sales staff and handoff rules
  salesHandoff: string;
  // 10. Service lane and retention gaps
  retentionMaturity: RetentionMaturity;
  // 11. Compliance boundaries
  complianceBoundaries: string;
  // 12. MVP budget and launch date
  mvpBudget: BudgetBand;
  launchDate: string;
}

export interface PackageRecommendation {
  tier: PackageTier;
  package: Package;
  rationale: string[];
  setupCad: Range;
  monthlyCad: Range;
  includedModules: string[];
  passThroughCosts: string[];
  launchTimeline: string;
  /** 0–10 ambition score used internally; surfaced for demo transparency. */
  fitScore: number;
}

/* ----------------------------------------------------------------------------
 * Integration adapters (all simulated in the demo)
 * --------------------------------------------------------------------------*/
export interface AdapterResult<T = unknown> {
  ok: boolean;
  /** Every mock returns true — the UI stays honest about simulation. */
  simulated: true;
  detail: string;
  data?: T;
}

/* ============================================================================
 * Portal / agent economy / proof — operational domain
 * (single source of truth for every domain type)
 * ==========================================================================*/

/* Tenant + people (demo only — no real auth) */
export type RoleId =
  | 'cognitia_admin'
  | 'demandara_operator'
  | 'dealer_owner'
  | 'sales_manager'
  | 'salesperson'
  | 'inventory_manager'
  | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  brand: string;
  businessType: string;
  primaryCity: string;
  citiesServed: string[];
  websiteDomain: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  isDemo: true;
}

/* Agent economy */
export type TrustTier = 'observe' | 'assist' | 'act_with_approval';

export interface AgentPermission {
  action: string;
  allowed: boolean;
}

export interface Agent {
  id: string;
  name: string;
  mission: string;
  allowedActions: string[];
  forbiddenActions: string[];
  /** Highest claim risk this agent may touch without escalation. */
  riskBoundary: RiskLevel;
  trustTier: TrustTier;
  /** Internal operational demo score (NOT an external certification). */
  trustScore: number;
}

/* AI drafts + human approval */
export type DraftKind =
  | 'lead_summary'
  | 'reply'
  | 'vehicle_listing'
  | 'seo_metadata'
  | 'social_caption'
  | 'reel_script';

export type DraftChannel = 'email' | 'sms' | 'whatsapp' | 'internal' | 'web';

export interface AIDraft {
  id: string;
  kind: DraftKind;
  channel: DraftChannel;
  agentId: string;
  /** leadId / vehicleId / customerId the draft is about (or null). */
  subjectId: string | null;
  subjectLabel: string;
  content: string;
  claimTypes: ClaimType[];
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  rationale: string;
  createdAt: string;
}

export type ApprovalDecision = 'approved' | 'rejected' | 'edited';
export type ApprovalStatusValue = 'pending' | ApprovalDecision;

export interface Approval {
  id: string;
  draftId: string;
  agentId: string;
  itemType: DraftKind;
  claimTypes: ClaimType[];
  riskLevel: RiskLevel;
  status: ApprovalStatusValue;
  decidedBy: string | null;
  decidedAt: string | null;
  editedContent?: string;
  note?: string;
}

/* Proof registry + action ledger (Cognitia core) */
export type LedgerActionType =
  | 'lead.captured'
  | 'lead.scored'
  | 'lead.stage_changed'
  | 'lead.assigned'
  | 'customer.created'
  | 'draft.created'
  | 'approval.decided'
  | 'message.sent'
  | 'inventory.published'
  | 'inventory.sold'
  | 'content.published'
  | 'agent.blocked'
  | 'discovery.completed'
  | 'proposal.generated';

export interface ActionLedgerEntry {
  id: string;
  actionType: LedgerActionType;
  actorType: 'human' | 'agent' | 'system';
  actorId: string;
  subjectId: string | null;
  summary: string;
  riskLevel?: RiskLevel;
  approvalId?: string | null;
  proofEventId?: string | null;
  createdAt: string;
}

/** Alias requested by spec — the ledger entry IS the canonical agent/human/system action record. */
export type AgentAction = ActionLedgerEntry;

export type ProofKind =
  | 'lead_captured'
  | 'response_time'
  | 'approval'
  | 'compliance_check'
  | 'publish'
  | 'outcome'
  | 'report';

export interface ProofEvent {
  id: string;
  kind: ProofKind;
  title: string;
  detail: string;
  source: string;
  metric?: { label: string; value: string };
  relatedLeadId?: string | null;
  relatedVehicleId?: string | null;
  relatedDraftId?: string | null;
  evidenceLabel: string;
  createdAt: string;
}

/* Appointments */
export type AppointmentType = 'test_drive' | 'finance_consult' | 'service';
export type AppointmentStatus = 'requested' | 'confirmed' | 'completed' | 'no_show';

export interface Appointment {
  id: string;
  leadId: string | null;
  customerName: string;
  vehicleId: string | null;
  vehicleLabel: string;
  type: AppointmentType;
  preferredTime: string;
  status: AppointmentStatus;
  owner: string;
  channel: string;
}

/* Content + social drafts */
export type ContentApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface ContentDraft {
  id: string;
  title: string;
  topic: string;
  body: string;
  claimTypes: ClaimType[];
  riskLevel: RiskLevel;
  approvalStatus: ContentApprovalStatus;
  createdAt: string;
}

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube';
export type SocialFormat = 'post' | 'reel' | 'story';

export interface SocialPostDraft {
  id: string;
  platform: SocialPlatform;
  format: SocialFormat;
  caption: string;
  script?: string;
  hashtags: string[];
  vehicleId: string | null;
  vehicleLabel: string;
  claimTypes: ClaimType[];
  riskLevel: RiskLevel;
  approvalStatus: ContentApprovalStatus;
  createdAt: string;
}

/* Demandara GTM prospects (dealership owners — NOT car shoppers) */
export type ProspectStage =
  | 'identified'
  | 'researching'
  | 'qualified'
  | 'contacted'
  | 'meeting_booked';

export interface GTMProspect {
  id: string;
  dealership: string;
  city: string;
  contactName: string;
  signalScore: number;
  stage: ProspectStage;
  notes: string;
  recommendedPackage: DiscoveryPackage;
  nextStep: string;
  createdAt: string;
}

/* Discovery console */
export type DiscoveryPackage =
  | 'Foundation Website'
  | 'Growth Engine'
  | 'Full Auto Growth OS'
  | 'Enterprise / Marketplace';

export interface DiscoveryScores {
  infrastructureReadiness: number;
  complexity: number;
  automation: number;
  contentBurden: number;
  integrationBurden: number;
  complianceRisk: number;
  urgency: number;
}

export type DiscoveryAnswerValue = string | number | boolean | string[];
export type DiscoveryAnswers = Record<string, DiscoveryAnswerValue>;

export interface DiscoverySession {
  id: string;
  dealership: string;
  answers: DiscoveryAnswers;
  scores: DiscoveryScores;
  recommendedPackage: DiscoveryPackage;
  createdAt: string;
}

/** A proposal generated from a discovery session. */
export interface Proposal {
  id: string;
  sessionId: string;
  dealership: string;
  recommendedPackage: DiscoveryPackage;
  pricingRange: string;
  markdown: string;
  createdAt: string;
}

/* Consent ledger (CASL) — 'not_established' = captured manually with no consent. */
export interface ConsentEvent {
  id: string;
  subjectId: string;
  channel: 'email' | 'sms' | 'whatsapp';
  basis: 'express' | 'implied' | 'withdrawn' | 'not_established';
  capturedAt: string;
}

/* Integration connection status (demo — never "connected" without approved access). */
export type IntegrationState = 'not_connected' | 'requires_access' | 'connected';

export interface IntegrationStatus {
  id: string;
  name: string;
  state: IntegrationState;
  note: string;
}
