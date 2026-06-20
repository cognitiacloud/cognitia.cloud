// types/portal.ts
// Domain model for the internal portal, agent economy, and proof/action ledger.
// Pure data shapes — behaviour lives in lib/{guardrails,agents,ai-drafts,proof,discovery}.
import type { ClaimType, RiskLevel } from '../lib/guardrails';

/* ----------------------------------------------------------------------------
 * Tenant + people (demo only — no real auth)
 * --------------------------------------------------------------------------*/
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

/* ----------------------------------------------------------------------------
 * Agent economy
 * --------------------------------------------------------------------------*/
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

/* ----------------------------------------------------------------------------
 * AI drafts + human approval
 * --------------------------------------------------------------------------*/
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

/* ----------------------------------------------------------------------------
 * Proof registry + action ledger (Cognitia core)
 * --------------------------------------------------------------------------*/
export type LedgerActionType =
  | 'lead.captured'
  | 'lead.scored'
  | 'customer.created'
  | 'draft.created'
  | 'approval.decided'
  | 'message.sent'
  | 'inventory.published'
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

/* ----------------------------------------------------------------------------
 * Appointments
 * --------------------------------------------------------------------------*/
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

/* ----------------------------------------------------------------------------
 * Content + social drafts
 * --------------------------------------------------------------------------*/
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

/* ----------------------------------------------------------------------------
 * Demandara GTM prospects (dealership owners — NOT car shoppers)
 * --------------------------------------------------------------------------*/
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

/* ----------------------------------------------------------------------------
 * Discovery console
 * --------------------------------------------------------------------------*/
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

/* ----------------------------------------------------------------------------
 * Consent ledger
 * --------------------------------------------------------------------------*/
export interface ConsentEvent {
  id: string;
  subjectId: string;
  channel: 'email' | 'sms' | 'whatsapp';
  basis: 'express' | 'implied' | 'withdrawn';
  capturedAt: string;
}
