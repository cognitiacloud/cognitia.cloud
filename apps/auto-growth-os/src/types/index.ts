// types/index.ts
// Single source of truth for the Cognitia Auto Growth OS domain model.
// Components and lib/* import their types from here only.

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
