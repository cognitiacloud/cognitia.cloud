/**
 * GTM-OS demo console — view-model TYPE-ALIGNED to the Client Zero Sales Closer
 * mock spine (`packages/agents/src/closer`).
 *
 * What this is (and is not):
 *   - It imports the closer spine's PUBLIC TYPES (type-only, from the barrel) and
 *     exposes synthetic, PRE-AUTHORED `CloserWorkflowRun` fixtures shaped exactly
 *     to that schema. The approve/reject controls swap between pre-authored
 *     outcome runs.
 *   - It does NOT execute the workflow runtime (`runCloserWorkflow`) in the
 *     browser, and it makes NO value import from `packages/agents/src/closer/**`
 *     (type-only imports only — that directory's runtime is network-free but is
 *     not run here).
 *
 * Mock-safe doctrine: synthetic, PII-safe data only (`example.com`, masked
 * contact). No network, no persistence, no sending, no live CRM write. Nothing
 * here triggers an external action.
 *
 * Temporary surface: PR #138 (`/operator`) remains the canonical operator
 * console target; `/gtm-os-demo` is a temporary, spine-typed demo route.
 */

import type {
  CloserAppointment,
  CloserComplianceDecision,
  CloserCrmRecord,
  CloserStateTransition,
  CloserWorkflowEventType,
  CloserWorkflowRun,
  CloserWorkflowState,
} from '../../../../packages/agents/src/closer/index';
import type { GtmProofEvent, GtmProofKind, GtmProspect, IsoTimestamp, Uuid } from '@cognitia/core';

/* ----------------------------------------------------------------- view types */

/** PII-safe lead detail projected from a `GtmProspect` (masked contact only). */
export interface GtmOsLeadDetail {
  company: string;
  location: string;
  businessType: string | null;
  source: string;
  sourceRisk: GtmProspect['sourceRisk'];
  contactRole: string | null;
  contactEmailMasked: string | null;
  contactPhoneMasked: string | null;
  contactDomain: string | null;
  contactBasis: GtmProspect['contactBasis'];
  consentStatus: GtmProspect['consentStatus'];
  unsubscribeStatus: GtmProspect['unsubscribeStatus'];
  doNotContact: boolean;
  fitScore: number;
}

/** The operator's human gating choice. `pending` = no decision recorded yet. */
export type GtmOsDecision = 'pending' | 'approve' | 'reject';

/** One step of the run timeline, derived from a run's visited states. */
export interface TimelineStep {
  state: CloserWorkflowState;
  label: string;
  reached: boolean;
  current: boolean;
}

/** A single fixture scenario for the demo console. */
export interface GtmOsScenario {
  id: string;
  title: string;
  leadDetail: GtmOsLeadDetail;
  /** Compliance decision from the spine schema (PII-safe normalized prospect). */
  compliance: CloserComplianceDecision;
  /** Hard-blocked at the compliance gate — can never be approved. */
  blocked: boolean;
  blockedReasons: string[];
  /** The run as it stands before a human decision (the spine-shaped baseline). */
  pendingRun: CloserWorkflowRun;
  /** Pre-authored terminal runs per decision (`null` when not applicable). */
  outcomes: Record<'approve' | 'reject', CloserWorkflowRun | null>;
}

/** Result of a gate check for an action (approve/reject). */
export interface DecisionGate {
  allowed: boolean;
  reason: string | null;
}

/* ------------------------------------------------------------- state labelling */

/** Human-readable labels for each workflow state. */
export const STATE_LABELS: Record<CloserWorkflowState, string> = {
  received: 'Lead received',
  compliance_blocked: 'Compliance blocked',
  awaiting_human_approval: 'Awaiting human approval',
  approved: 'Human approved',
  appointment_ready: 'Appointment booked (mock)',
  crm_written: 'CRM writeback (mock)',
  proof_ready: 'Proof report ready',
  rejected: 'Rejected by reviewer',
};

/**
 * The canonical happy-path order, declared locally (NOT imported as a value, to
 * keep this module's only dependency on the spine type-only).
 */
const HAPPY_PATH_ORDER: readonly CloserWorkflowState[] = [
  'received',
  'awaiting_human_approval',
  'approved',
  'appointment_ready',
  'crm_written',
  'proof_ready',
];

/* ------------------------------------------------------------------- selectors */

/** Pick the run to display for the current decision. */
export function selectRun(scenario: GtmOsScenario, decision: GtmOsDecision): CloserWorkflowRun {
  if (decision === 'pending') return scenario.pendingRun;
  return scenario.outcomes[decision] ?? scenario.pendingRun;
}

/**
 * Build the run timeline from a run's actual visited states (`run.history`).
 * For happy/blocked/rejected runs alike this reflects exactly which states the
 * pre-authored run passed through, with the final state marked `current`.
 */
export function runTimeline(run: CloserWorkflowRun): TimelineStep[] {
  const visited = new Set<CloserWorkflowState>(run.history);
  const last = run.history[run.history.length - 1];
  // Show the canonical happy path, plus any terminal branch state the run hit.
  const states: CloserWorkflowState[] = [...HAPPY_PATH_ORDER];
  for (const branch of ['compliance_blocked', 'rejected'] as const) {
    if (visited.has(branch) && !states.includes(branch)) {
      // Insert the terminal branch right after the state it diverged from.
      states.push(branch);
    }
  }
  return states.map((state) => ({
    state,
    label: STATE_LABELS[state],
    reached: visited.has(state),
    current: state === last,
  }));
}

/** Whether the operator may approve this scenario at the given decision state. */
export function canApprove(scenario: GtmOsScenario, decision: GtmOsDecision): DecisionGate {
  if (scenario.blocked) {
    return { allowed: false, reason: 'Blocked at the compliance gate — cannot approve.' };
  }
  if (decision !== 'pending') {
    return {
      allowed: false,
      reason: `Already ${decision === 'approve' ? 'approved' : 'rejected'}.`,
    };
  }
  return { allowed: true, reason: null };
}

/** Whether the operator may reject this scenario at the given decision state. */
export function canReject(scenario: GtmOsScenario, decision: GtmOsDecision): DecisionGate {
  if (scenario.blocked) {
    return { allowed: false, reason: 'Already terminal (compliance blocked).' };
  }
  if (decision !== 'pending') {
    return {
      allowed: false,
      reason: `Already ${decision === 'approve' ? 'approved' : 'rejected'}.`,
    };
  }
  return { allowed: true, reason: null };
}

/** Mock appointment status label for display. */
export function appointmentStatusLabel(run: CloserWorkflowRun): string {
  if (!run.appointment) return 'No appointment (mock)';
  return `Booked ${formatSlot(run.appointment.slotStart)} (mock — no calendar contacted)`;
}

/** Mock CRM writeback status label for display. */
export function crmStatusLabel(run: CloserWorkflowRun): string {
  if (!run.crmRecord) return 'Not written (mock)';
  const replay = run.crmCreated ? 'new record' : 'idempotent replay';
  return `${run.crmRecord.externalId} · ${replay} (mock — no live CRM)`;
}

/** Proof receipt summary for display. */
export function proofReceipt(run: CloserWorkflowRun): {
  ready: boolean;
  finalState: CloserWorkflowState;
  summary: string;
  events: GtmProofEvent[];
} {
  return {
    ready: run.proofReport.finalState === 'proof_ready',
    finalState: run.proofReport.finalState,
    summary: run.proofReport.summary,
    events: run.proofReport.proofEvents,
  };
}

function formatSlot(iso: IsoTimestamp): string {
  // Stable, locale-independent rendering (avoids hydration drift).
  return iso.replace('T', ' ').replace('.000Z', ' UTC');
}

/* -------------------------------------------------------------- fixture builders */

const TENANT: Uuid = '11111111-1111-4111-8111-111111111111';
const ACTOR = 'agent:closer';

let proofSeq = 0;
function proofId(): Uuid {
  proofSeq += 1;
  return `00000000-0000-4000-8000-${String(proofSeq).padStart(12, '0')}`;
}

function proofEvent(
  kind: GtmProofKind,
  subjectId: Uuid,
  summaryPublic: string,
  occurredAt: IsoTimestamp,
): GtmProofEvent {
  return {
    id: proofId(),
    kind,
    subjectType: 'closer_lead',
    subjectId,
    evidenceTag: 'verified_fact',
    summaryPublic,
    detailsPrivate: {},
    occurredAt,
    actorRef: ACTOR,
  };
}

function ok(
  from: CloserWorkflowState,
  to: CloserWorkflowState,
  event: CloserWorkflowEventType,
): CloserStateTransition {
  return { ok: true, from, to, event };
}

interface ProspectSeed {
  id: Uuid;
  company: string;
  city: string;
  region: string;
  domain: string;
  contactRole: string;
  emailMasked: string;
  phoneMasked: string;
  source: string;
  sourceRisk: GtmProspect['sourceRisk'];
  contactBasis: GtmProspect['contactBasis'];
  consentStatus: GtmProspect['consentStatus'];
  unsubscribeStatus: GtmProspect['unsubscribeStatus'];
  doNotContact: boolean;
  fitScore: number;
}

/** Build a full, synthetic, PII-safe `GtmProspect` (no raw email/phone). */
function makeProspect(seed: ProspectSeed): GtmProspect {
  return {
    id: seed.id,
    companyName: seed.company,
    website: `https://${seed.domain}`,
    city: seed.city,
    provinceOrState: seed.region,
    country: 'US',
    businessType: 'independent_dealer',
    inventoryModelGuess: null,
    source: seed.source,
    sourceUrl: `https://directory.example.com/${seed.id}`,
    sourceRisk: seed.sourceRisk,
    contactName: null,
    contactRole: seed.contactRole,
    contactEmailHash: null,
    contactPhoneHash: null,
    contactEmailMasked: seed.emailMasked,
    contactPhoneMasked: seed.phoneMasked,
    contactDomain: seed.domain,
    contactBasis: seed.contactBasis,
    consentStatus: seed.consentStatus,
    unsubscribeStatus: seed.unsubscribeStatus,
    doNotContact: seed.doNotContact,
    fitScore: seed.fitScore,
    packageFit: null,
    discoveryStatus: 'not_started',
    proposalStatus: 'none',
    assignedOwner: null,
    lastContactedAt: null,
    nextStep: null,
    notes: null,
    createdAt: '2026-06-20T12:00:00.000Z',
    updatedAt: '2026-06-20T12:00:00.000Z',
  };
}

function leadDetail(p: GtmProspect): GtmOsLeadDetail {
  const location = [p.city, p.provinceOrState, p.country].filter(Boolean).join(', ') || '—';
  return {
    company: p.companyName,
    location,
    businessType: p.businessType,
    source: p.source,
    sourceRisk: p.sourceRisk,
    contactRole: p.contactRole,
    contactEmailMasked: p.contactEmailMasked,
    contactPhoneMasked: p.contactPhoneMasked,
    contactDomain: p.contactDomain,
    contactBasis: p.contactBasis,
    consentStatus: p.consentStatus,
    unsubscribeStatus: p.unsubscribeStatus,
    doNotContact: p.doNotContact,
    fitScore: p.fitScore,
  };
}

const T0 = '2026-06-21T09:00:00.000Z';
const T1 = '2026-06-21T09:00:01.000Z';
const T2 = '2026-06-21T09:00:02.000Z';

function appointment(leadRef: string, id: string): CloserAppointment {
  return {
    appointmentRef: `appt_${id}`,
    tenantId: TENANT,
    leadRef,
    slotStart: '2026-06-22T09:00:00.000Z',
    slotEnd: '2026-06-22T09:30:00.000Z',
    mode: 'mock',
  };
}

function crmRecord(leadRef: string, id: string, company: string, domain: string): CloserCrmRecord {
  return {
    externalId: `mockcrm_${id}`,
    idempotencyKey: `idem_${id}`,
    tenantId: TENANT,
    leadRef,
    companyName: company,
    contactDomain: domain,
    appointmentRef: `appt_${id}`,
    slotStart: '2026-06-22T09:00:00.000Z',
    createdAt: T2,
  };
}

interface CleanScenarioInput {
  id: string;
  title: string;
  leadRef: string;
  seed: ProspectSeed;
}

/** Build a clean (approvable) scenario: pending + approve/reject outcome runs. */
function buildCleanScenario(input: CleanScenarioInput): GtmOsScenario {
  const prospect = makeProspect(input.seed);
  const subjectId = prospect.id;
  const compliance: CloserComplianceDecision = {
    passed: true,
    reason: 'No suppression flags; contact basis and consent permit human-gated review.',
    requiresHumanReview: true,
    prospect,
  };

  const sourced = proofEvent(
    'gtm.prospect.sourced.v1',
    subjectId,
    `Lead received for ${prospect.companyName} (${prospect.contactDomain}).`,
    T0,
  );

  const pendingRun: CloserWorkflowRun = {
    finalState: 'awaiting_human_approval',
    history: ['received', 'awaiting_human_approval'],
    transitions: [ok('received', 'awaiting_human_approval', 'RUN_COMPLIANCE_GATE')],
    compliance,
    appointment: null,
    crmRecord: null,
    crmCreated: false,
    proofReport: {
      tenantId: TENANT,
      leadRef: input.leadRef,
      finalState: 'awaiting_human_approval',
      compliancePassed: true,
      humanApproved: false,
      appointmentRef: null,
      crmExternalRef: null,
      states: ['received', 'awaiting_human_approval'],
      proofEvents: [sourced],
      generatedAt: T0,
      summary: 'Lead cleared compliance and is awaiting a human approval decision.',
    },
  };

  const appt = appointment(input.leadRef, input.id);
  const crm = crmRecord(
    input.leadRef,
    input.id,
    prospect.companyName,
    prospect.contactDomain ?? '',
  );
  const booked = proofEvent(
    'gtm.discovery.booked.v1',
    subjectId,
    `Discovery booked for ${prospect.companyName}; CRM ref ${crm.externalId}.`,
    T2,
  );

  const approveRun: CloserWorkflowRun = {
    finalState: 'proof_ready',
    history: [
      'received',
      'awaiting_human_approval',
      'approved',
      'appointment_ready',
      'crm_written',
      'proof_ready',
    ],
    transitions: [
      ok('received', 'awaiting_human_approval', 'RUN_COMPLIANCE_GATE'),
      ok('awaiting_human_approval', 'approved', 'HUMAN_DECISION'),
      ok('approved', 'appointment_ready', 'BOOK_APPOINTMENT'),
      ok('appointment_ready', 'crm_written', 'WRITE_CRM'),
      ok('crm_written', 'proof_ready', 'EMIT_PROOF'),
    ],
    compliance,
    appointment: appt,
    crmRecord: crm,
    crmCreated: true,
    proofReport: {
      tenantId: TENANT,
      leadRef: input.leadRef,
      finalState: 'proof_ready',
      compliancePassed: true,
      humanApproved: true,
      appointmentRef: appt.appointmentRef,
      crmExternalRef: crm.externalId,
      states: [
        'received',
        'awaiting_human_approval',
        'approved',
        'appointment_ready',
        'crm_written',
        'proof_ready',
      ],
      proofEvents: [sourced, booked],
      generatedAt: T2,
      summary:
        'Lead closed through the full pipeline: consent cleared, human-approved, appointment booked (mock), CRM written (mock), proof emitted.',
    },
  };

  const rejectedNote = proofEvent(
    'gtm.outreach.review_required.v1',
    subjectId,
    'Human reviewer rejected the lead.',
    T1,
  );
  const rejectRun: CloserWorkflowRun = {
    finalState: 'rejected',
    history: ['received', 'awaiting_human_approval', 'rejected'],
    transitions: [
      ok('received', 'awaiting_human_approval', 'RUN_COMPLIANCE_GATE'),
      ok('awaiting_human_approval', 'rejected', 'HUMAN_DECISION'),
    ],
    compliance,
    appointment: null,
    crmRecord: null,
    crmCreated: false,
    proofReport: {
      tenantId: TENANT,
      leadRef: input.leadRef,
      finalState: 'rejected',
      compliancePassed: true,
      humanApproved: false,
      appointmentRef: null,
      crmExternalRef: null,
      states: ['received', 'awaiting_human_approval', 'rejected'],
      proofEvents: [sourced, rejectedNote],
      generatedAt: T1,
      summary: 'Lead cleared compliance but was rejected by the human reviewer.',
    },
  };

  return {
    id: input.id,
    title: input.title,
    leadDetail: leadDetail(prospect),
    compliance,
    blocked: false,
    blockedReasons: [],
    pendingRun,
    outcomes: { approve: approveRun, reject: rejectRun },
  };
}

interface BlockedScenarioInput {
  id: string;
  title: string;
  leadRef: string;
  seed: ProspectSeed;
  reason: string;
  blockedReasons: string[];
}

/** Build a compliance-blocked scenario: terminal, never approvable. */
function buildBlockedScenario(input: BlockedScenarioInput): GtmOsScenario {
  const prospect = makeProspect(input.seed);
  const subjectId = prospect.id;
  const compliance: CloserComplianceDecision = {
    passed: false,
    reason: input.reason,
    requiresHumanReview: true,
    prospect,
  };
  const sourced = proofEvent(
    'gtm.prospect.sourced.v1',
    subjectId,
    `Lead received for ${prospect.companyName} (${prospect.contactDomain}).`,
    T0,
  );
  const blockedEvent = proofEvent(
    'gtm.outreach.review_required.v1',
    subjectId,
    `Blocked at compliance gate: ${input.reason}`,
    T1,
  );
  const pendingRun: CloserWorkflowRun = {
    finalState: 'compliance_blocked',
    history: ['received', 'compliance_blocked'],
    transitions: [ok('received', 'compliance_blocked', 'RUN_COMPLIANCE_GATE')],
    compliance,
    appointment: null,
    crmRecord: null,
    crmCreated: false,
    proofReport: {
      tenantId: TENANT,
      leadRef: input.leadRef,
      finalState: 'compliance_blocked',
      compliancePassed: false,
      humanApproved: false,
      appointmentRef: null,
      crmExternalRef: null,
      states: ['received', 'compliance_blocked'],
      proofEvents: [sourced, blockedEvent],
      generatedAt: T1,
      summary: `Lead blocked at the compliance gate (${input.reason}).`,
    },
  };
  return {
    id: input.id,
    title: input.title,
    leadDetail: leadDetail(prospect),
    compliance,
    blocked: true,
    blockedReasons: input.blockedReasons,
    pendingRun,
    outcomes: { approve: null, reject: null },
  };
}

/** The synthetic demo scenarios (PII-safe, spine-typed). */
export const GTM_OS_SCENARIOS: GtmOsScenario[] = [
  buildCleanScenario({
    id: 'northwind',
    title: 'Northwind Auto Group',
    leadRef: 'lead:22222222-2222-4222-8222-222222222222',
    seed: {
      id: '33333333-3333-4333-8333-333333333333',
      company: 'Northwind Auto Group',
      city: 'Austin',
      region: 'TX',
      domain: 'northwind-auto.example.com',
      contactRole: 'General Manager',
      emailMasked: 'p***@northwind-auto.example.com',
      phoneMasked: '***-***-0100',
      source: 'industry_directory',
      sourceRisk: 'low',
      contactBasis: 'conspicuously_published_business_contact',
      consentStatus: 'implied_possible',
      unsubscribeStatus: 'subscribed',
      doNotContact: false,
      fitScore: 0.72,
    },
  }),
  buildBlockedScenario({
    id: 'cypress',
    title: 'Cypress Motors',
    leadRef: 'lead:44444444-4444-4444-8444-444444444444',
    seed: {
      id: '55555555-5555-4555-8555-555555555555',
      company: 'Cypress Motors',
      city: 'Tampa',
      region: 'FL',
      domain: 'cypress-motors.example.com',
      contactRole: 'Sales Director',
      emailMasked: 's***@cypress-motors.example.com',
      phoneMasked: '***-***-0188',
      source: 'industry_directory',
      sourceRisk: 'low',
      contactBasis: 'conspicuously_published_business_contact',
      consentStatus: 'do_not_contact',
      unsubscribeStatus: 'subscribed',
      doNotContact: true,
      fitScore: 0.64,
    },
    reason: 'Prospect is flagged do-not-contact.',
    blockedReasons: ['Prospect is flagged do-not-contact.', 'Consent status is do-not-contact.'],
  }),
  buildCleanScenario({
    id: 'lakeside',
    title: 'Lakeside Auto',
    leadRef: 'lead:66666666-6666-4666-8666-666666666666',
    seed: {
      id: '77777777-7777-4777-8777-777777777777',
      company: 'Lakeside Auto',
      city: 'Denver',
      region: 'CO',
      domain: 'lakeside-auto.example.com',
      contactRole: 'Owner',
      emailMasked: 'o***@lakeside-auto.example.com',
      phoneMasked: '***-***-0142',
      source: 'oem_locator',
      sourceRisk: 'medium',
      contactBasis: 'conspicuously_published_business_contact',
      consentStatus: 'implied_possible',
      unsubscribeStatus: 'subscribed',
      doNotContact: false,
      fitScore: 0.81,
    },
  }),
];
