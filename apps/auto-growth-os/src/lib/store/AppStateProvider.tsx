'use client';

// lib/store/AppStateProvider.tsx
// Single demo store for the whole Auto Growth OS. Seeded from data/*.json
// (deterministic for SSR), hydrated from localStorage after mount (merged over the
// seed defaults so older snapshots stay compatible), persisted on every mutation.
// Server components read seed JSON directly; only interactive client pages consume
// this provider. All ids/timestamps are created inside actions (never during
// render) so SSR stays deterministic. Every meaningful mutation also emits an
// ActionLedgerEntry and, where it is evidence-worthy, a ProofEvent.

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AIDraft,
  ActionLedgerEntry,
  Appointment,
  Approval,
  ApprovalDecision,
  ConsentEvent,
  ContentDraft,
  Customer,
  DiscoveryAnswers,
  DiscoverySession,
  DraftKind,
  GTMProspect,
  IntegrationStatus,
  Lead,
  LeadFormInput,
  Proposal,
  ProofEvent,
  RoleId,
  ScoringSignals,
  SocialPostDraft,
  Stage,
  Vehicle,
} from '@/types';
import { scoreAndStage } from '@/lib/scoring';
import { canAgentPerform } from '@/lib/agents';
import { generateLeadSummary } from '@/lib/ai-drafts';
import { scanSensitiveClaims } from '@/lib/guardrails';
import {
  createLedgerEntry as buildLedgerEntry,
  createProofEvent as buildProofEvent,
} from '@/lib/proof';
import {
  buildCustomerFromLead,
  consentEventsFromLead,
  findExistingCustomer,
} from '@/lib/customers';
import { canMarkSold } from '@/lib/pipeline';
import {
  discoverySessionFromAnswers,
  gtmProspectFromDiscovery,
  proposalFromDiscovery,
} from '@/lib/proposals';
import { normalizeAppState } from '@/lib/normalize';
import { adapters } from '@/lib/adapters';
import { makeId, nowIso } from '@/lib/id';
import leadsRaw from '@/data/leads.json';
import customersRaw from '@/data/customers.json';
import vehiclesRaw from '@/data/vehicles.json';
import aiDraftsRaw from '@/data/aiDrafts.json';
import approvalsRaw from '@/data/approvals.json';
import ledgerRaw from '@/data/actionLedger.json';
import proofRaw from '@/data/proofEvents.json';
import appointmentsRaw from '@/data/appointments.json';
import contentRaw from '@/data/contentDrafts.json';
import socialRaw from '@/data/socialDrafts.json';
import prospectsRaw from '@/data/gtmProspects.json';

const STORAGE_KEY = 'cognitia.demo.v2';
const DEFAULT_ROLE: RoleId = 'dealer_owner';

/** Seed integration checklist. Honest by default — nothing is "connected". */
const DEFAULT_INTEGRATIONS: IntegrationStatus[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    state: 'requires_access',
    note: 'Human-approved messaging; connects after access is approved at scope lock.',
  },
  {
    id: 'crm',
    name: 'CRM / DMS',
    state: 'requires_access',
    note: 'Two-way lead sync. Simulated in the demo — no real records are written.',
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    state: 'not_connected',
    note: 'Client owns the ad account; reporting is read-only.',
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    state: 'not_connected',
    note: 'Client owns the ad account; reporting is read-only.',
  },
  {
    id: 'gbp',
    name: 'Google Business Profile',
    state: 'not_connected',
    note: 'Access granted by the dealership when ready.',
  },
  {
    id: 'analytics',
    name: 'Analytics & Search Console',
    state: 'not_connected',
    note: 'Measurement foundations only — no rankings or inclusion are promised.',
  },
];

interface DemoState {
  role: RoleId;
  leads: Lead[];
  customers: Customer[];
  consentEvents: ConsentEvent[];
  vehicles: Vehicle[];
  aiDrafts: AIDraft[];
  approvals: Approval[];
  ledger: ActionLedgerEntry[];
  proofEvents: ProofEvent[];
  appointments: Appointment[];
  contentDrafts: ContentDraft[];
  socialDrafts: SocialPostDraft[];
  gtmProspects: GTMProspect[];
  discoverySessions: DiscoverySession[];
  proposals: Proposal[];
  integrations: IntegrationStatus[];
}

function seedState(): DemoState {
  return {
    role: DEFAULT_ROLE,
    leads: leadsRaw as Lead[],
    customers: customersRaw as Customer[],
    consentEvents: [],
    vehicles: vehiclesRaw as Vehicle[],
    aiDrafts: aiDraftsRaw as AIDraft[],
    approvals: approvalsRaw as Approval[],
    ledger: ledgerRaw as ActionLedgerEntry[],
    proofEvents: proofRaw as ProofEvent[],
    appointments: appointmentsRaw as Appointment[],
    contentDrafts: contentRaw as ContentDraft[],
    socialDrafts: socialRaw as SocialPostDraft[],
    gtmProspects: prospectsRaw as GTMProspect[],
    discoverySessions: [],
    proposals: [],
    integrations: DEFAULT_INTEGRATIONS,
  };
}

export interface AppState extends DemoState {
  /** False during SSR and first client render; true after hydration. */
  mounted: boolean;
  // leads
  createLead: (input: LeadFormInput) => Lead;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  updateLeadStage: (id: string, stage: Stage) => void;
  assignLead: (id: string, owner: string) => void;
  // customers
  createCustomer: (input: {
    name: string;
    email?: string;
    phone?: string;
    vehicle?: string;
    location?: string;
  }) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  // governance / spine
  setRole: (role: RoleId) => void;
  createProofEvent: (e: Omit<ProofEvent, 'id' | 'createdAt'>) => ProofEvent;
  createActionLedgerEntry: (e: Omit<ActionLedgerEntry, 'id' | 'createdAt'>) => ActionLedgerEntry;
  // ai drafts + approvals
  createAiDraft: (leadId: string, kind?: DraftKind) => Promise<AIDraft | null>;
  createApproval: (input: Omit<Approval, 'id' | 'status' | 'decidedBy' | 'decidedAt'>) => Approval;
  approveAiDraft: (id: string, opts?: { editedContent?: string; note?: string }) => Promise<void>;
  rejectAiDraft: (id: string, opts?: { note?: string }) => void;
  // inventory + content
  createVehicle: (v: Vehicle) => void;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  publishVehicle: (id: string) => { ok: boolean; reason?: string };
  markVehicleSold: (id: string) => { ok: boolean; reason?: string };
  decideContent: (id: string, decision: ApprovalDecision) => void;
  decideSocial: (id: string, decision: ApprovalDecision) => void;
  // demandara gtm + discovery + appointments
  createGtmProspect: (p: Omit<GTMProspect, 'id' | 'createdAt'>) => GTMProspect;
  saveDiscoverySession: (answers: DiscoveryAnswers) => DiscoverySession;
  generateProposalFromDiscovery: (session: DiscoverySession) => {
    proposal: Proposal;
    prospect: GTMProspect;
  };
  createAppointment: (a: Omit<Appointment, 'id'>) => Appointment;
  resetDemo: () => void;
}

export const AppStateContext = createContext<AppState | null>(null);

function nextActionForStage(stage: Stage): string {
  switch (stage) {
    case 'Immediate Sales Handoff':
      return 'Call now — route to senior closer';
    case 'Hot Lead':
      return 'Contact within SLA — high intent';
    case 'Qualified':
      return 'Follow up with matching inventory';
    default:
      return 'Add to nurture sequence';
  }
}

function buildLead(input: LeadFormInput, now: string): Lead {
  const signals: ScoringSignals = {
    appointmentRequested: input.appointmentRequested,
    financingRequested: input.financingRequested,
    tradeInMentioned: input.tradeInMentioned,
    budgetProvided: typeof input.budgetCad === 'number' && input.budgetCad > 0,
    respondToday: input.respondToday,
    specificVehicleSelected: Boolean(input.vehicleId),
  };
  const { score, stage } = scoreAndStage(signals);
  const anyConsent = input.consent.email || input.consent.sms || input.consent.whatsapp;

  return {
    id: makeId('LD'),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    source: input.source ?? 'Website',
    vehicleInterest: input.vehicleInterest || 'General inquiry',
    vehicleId: input.vehicleId,
    budgetCad: input.budgetCad,
    message: input.message.trim(),
    signals,
    score,
    stage,
    owner: score >= 61 ? 'Priya Anand' : 'Unassigned',
    nextAction: nextActionForStage(stage),
    consent: {
      email: input.consent.email,
      sms: input.consent.sms,
      whatsapp: input.consent.whatsapp,
      capturedAt: anyConsent ? now : null,
      basis: anyConsent ? 'express' : 'none',
    },
    firstResponseMinutes: 1,
    createdAt: now,
    isDemo: true,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(seedState);
  const [mounted, setMounted] = useState(false);

  // Mirror state into a ref so stable actions can read the latest snapshot.
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge over the seed defaults: older snapshots predate newer slices.
        setState((prev) => normalizeAppState(parsed, prev));
      }
    } catch {
      // Corrupt/blocked storage → keep seed.
    }
    setMounted(true);
  }, []);

  const apply = useCallback((mut: (s: DemoState) => DemoState) => {
    setState((prev) => {
      const next = mut(prev);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota/private-mode
      }
      return next;
    });
  }, []);

  const createProofEvent = useCallback(
    (e: Omit<ProofEvent, 'id' | 'createdAt'>): ProofEvent => {
      const ev = buildProofEvent(e, makeId('proof'), nowIso());
      apply((s) => ({ ...s, proofEvents: [ev, ...s.proofEvents] }));
      return ev;
    },
    [apply],
  );

  const createActionLedgerEntry = useCallback(
    (e: Omit<ActionLedgerEntry, 'id' | 'createdAt'>): ActionLedgerEntry => {
      const a = buildLedgerEntry(e, makeId('act'), nowIso());
      apply((s) => ({ ...s, ledger: [a, ...s.ledger] }));
      return a;
    },
    [apply],
  );

  const createLead = useCallback(
    (input: LeadFormInput): Lead => {
      const now = nowIso();
      const base = buildLead(input, now);
      // Link to an existing customer (phone, then email) or build one from the lead.
      const existing = findExistingCustomer(ref.current.customers, {
        phone: base.phone,
        email: base.email,
      });
      const customer = existing ?? buildCustomerFromLead(base, makeId('C'), now);
      const isNewCustomer = !existing;
      const lead: Lead = { ...base, customerId: customer.id };
      const consentEvents = isNewCustomer
        ? consentEventsFromLead(lead, customer.id, lead.id, now)
        : [];

      const captured = buildProofEvent(
        {
          kind: 'lead_captured',
          title: `Lead captured — ${lead.name}`,
          detail: `${lead.source} • ${lead.vehicleInterest}`,
          source: 'public_form',
          relatedLeadId: lead.id,
          evidenceLabel: 'Form submission',
        },
        makeId('proof'),
        now,
      );
      const responded = buildProofEvent(
        {
          kind: 'response_time',
          title: `First response to ${lead.name}`,
          detail: 'Auto-acknowledged within SLA.',
          source: 'system',
          metric: { label: 'First response', value: '1 min' },
          relatedLeadId: lead.id,
          evidenceLabel: 'SLA snapshot',
        },
        makeId('proof'),
        now,
      );
      const a1 = buildLedgerEntry(
        {
          actionType: 'lead.captured',
          actorType: 'system',
          actorId: 'lead-intake',
          subjectId: lead.id,
          summary: `Lead captured from ${lead.source}`,
          riskLevel: 'low',
          proofEventId: captured.id,
        },
        makeId('act'),
        now,
      );
      const a2 = buildLedgerEntry(
        {
          actionType: 'lead.scored',
          actorType: 'agent',
          actorId: 'lead-intake',
          subjectId: lead.id,
          summary: `Scored ${lead.score} → ${lead.stage}`,
          riskLevel: 'low',
        },
        makeId('act'),
        now,
      );
      const customerLog = isNewCustomer
        ? buildLedgerEntry(
            {
              actionType: 'customer.created',
              actorType: 'system',
              actorId: 'lead-intake',
              subjectId: customer.id,
              summary: `Customer record created from lead — ${customer.name}`,
              riskLevel: 'low',
            },
            makeId('act'),
            now,
          )
        : null;

      apply((s) => ({
        ...s,
        leads: [lead, ...s.leads],
        customers: isNewCustomer ? [customer, ...s.customers] : s.customers,
        consentEvents: [...consentEvents, ...s.consentEvents],
        proofEvents: [responded, captured, ...s.proofEvents],
        ledger: [...(customerLog ? [customerLog] : []), a2, a1, ...s.ledger],
      }));
      return lead;
    },
    [apply],
  );

  const updateLead = useCallback(
    (id: string, patch: Partial<Lead>) => {
      apply((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    },
    [apply],
  );

  const updateLeadStage = useCallback(
    (id: string, stage: Stage) => {
      const lead = ref.current.leads.find((l) => l.id === id);
      if (!lead || lead.stage === stage) return;
      const entry = buildLedgerEntry(
        {
          actionType: 'lead.stage_changed',
          actorType: 'human',
          actorId: ref.current.role,
          subjectId: id,
          summary: `Stage changed ${lead.stage} → ${stage}`,
          riskLevel: 'low',
        },
        makeId('act'),
        nowIso(),
      );
      apply((s) => ({
        ...s,
        leads: s.leads.map((l) =>
          l.id === id ? { ...l, stage, nextAction: nextActionForStage(stage) } : l,
        ),
        ledger: [entry, ...s.ledger],
      }));
    },
    [apply],
  );

  const assignLead = useCallback(
    (id: string, owner: string) => {
      const lead = ref.current.leads.find((l) => l.id === id);
      if (!lead || lead.owner === owner) return;
      const entry = buildLedgerEntry(
        {
          actionType: 'lead.assigned',
          actorType: 'human',
          actorId: ref.current.role,
          subjectId: id,
          summary: `Assigned to ${owner}`,
          riskLevel: 'low',
        },
        makeId('act'),
        nowIso(),
      );
      apply((s) => ({
        ...s,
        leads: s.leads.map((l) => (l.id === id ? { ...l, owner } : l)),
        ledger: [entry, ...s.ledger],
      }));
    },
    [apply],
  );

  const createCustomer = useCallback(
    (input: {
      name: string;
      email?: string;
      phone?: string;
      vehicle?: string;
      location?: string;
    }): Customer => {
      const now = nowIso();
      const id = makeId('C');
      const customer: Customer = {
        id,
        name: input.name.trim() || 'New customer',
        vehicle: input.vehicle?.trim() || 'General inquiry',
        preferredChannel: 'email',
        familyNote: '',
        preferences: [],
        lastConcern: '',
        nextAction: 'Reach out to confirm details',
        loyaltyMonths: 0,
        consent: { email: false, sms: false, whatsapp: false, capturedAt: null, basis: 'none' },
        timeline: [
          {
            id: `${id}-t1`,
            kind: 'inquiry',
            label: 'Record created',
            date: now.slice(0, 10),
            detail: 'Customer added manually in the portal.',
          },
        ],
        email: input.email?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        location: input.location?.trim() || undefined,
        isDemo: true,
      };
      // Manual creation captures no consent → conservative, honest status.
      const consentEvent: ConsentEvent = {
        id: `${id}-c0`,
        subjectId: id,
        channel: 'email',
        basis: 'not_established',
        capturedAt: now,
      };
      const log = buildLedgerEntry(
        {
          actionType: 'customer.created',
          actorType: 'human',
          actorId: ref.current.role,
          subjectId: id,
          summary: `Customer record created — ${customer.name}`,
          riskLevel: 'low',
        },
        makeId('act'),
        now,
      );
      apply((s) => ({
        ...s,
        customers: [customer, ...s.customers],
        consentEvents: [consentEvent, ...s.consentEvents],
        ledger: [log, ...s.ledger],
      }));
      return customer;
    },
    [apply],
  );

  const updateCustomer = useCallback(
    (id: string, patch: Partial<Customer>) => {
      apply((s) => ({
        ...s,
        customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
    },
    [apply],
  );

  const setRole = useCallback((role: RoleId) => apply((s) => ({ ...s, role })), [apply]);

  const createApproval = useCallback(
    (input: Omit<Approval, 'id' | 'status' | 'decidedBy' | 'decidedAt'>): Approval => {
      const approval: Approval = {
        ...input,
        id: makeId('appr'),
        status: 'pending',
        decidedBy: null,
        decidedAt: null,
      };
      apply((s) => ({ ...s, approvals: [approval, ...s.approvals] }));
      return approval;
    },
    [apply],
  );

  const createAiDraft = useCallback(
    async (leadId: string, kind: DraftKind = 'reply'): Promise<AIDraft | null> => {
      const lead = ref.current.leads.find((l) => l.id === leadId);
      if (!lead) return null;
      const action = kind === 'lead_summary' ? 'summarize_lead' : 'draft_reply';
      if (!canAgentPerform('sales-draft', action)) {
        createActionLedgerEntry({
          actionType: 'agent.blocked',
          actorType: 'system',
          actorId: 'sales-draft',
          subjectId: leadId,
          summary: 'Auto action blocked by agent policy — human required.',
          riskLevel: 'high',
        });
        return null;
      }

      let draftKind: DraftKind;
      let content: string;
      let rationale: string;
      let claimTypes: AIDraft['claimTypes'];
      let riskLevel: AIDraft['riskLevel'];
      let requiresApproval: boolean;

      if (kind === 'lead_summary') {
        // Internal summary — never sent to a customer, so never auto-gated.
        const summary = generateLeadSummary(lead);
        draftKind = summary.kind;
        content = summary.content;
        rationale = summary.rationale;
        claimTypes = summary.claimTypes;
        riskLevel = summary.riskLevel;
        requiresApproval = summary.requiresApproval;
      } else {
        // Outbound reply: route through the AI adapter (human approval is mandatory
        // by contract) and classify the returned draft for claim risk.
        const res = await adapters.ai.draftReply({ lead, history: [] });
        const scan = scanSensitiveClaims(res.draft);
        draftKind = 'reply';
        content = res.draft;
        rationale = res.rationale;
        claimTypes = scan.claimTypes;
        riskLevel = scan.riskLevel;
        requiresApproval = res.requiresHumanApproval;
      }

      const now = nowIso();
      const draft: AIDraft = {
        id: makeId('draft'),
        kind: draftKind,
        channel: 'whatsapp',
        agentId: 'sales-draft',
        subjectId: lead.id,
        subjectLabel: `${lead.name} · ${lead.vehicleInterest}`,
        content,
        claimTypes,
        riskLevel,
        requiresApproval,
        rationale,
        createdAt: now,
      };
      const created = buildLedgerEntry(
        {
          actionType: 'draft.created',
          actorType: 'agent',
          actorId: 'sales-draft',
          subjectId: draft.id,
          summary: `Drafted ${draft.kind} for ${lead.name}`,
          riskLevel: draft.riskLevel,
        },
        makeId('act'),
        now,
      );
      const approval: Approval | null = draft.requiresApproval
        ? {
            id: makeId('appr'),
            draftId: draft.id,
            agentId: 'sales-draft',
            itemType: draft.kind,
            claimTypes: draft.claimTypes,
            riskLevel: draft.riskLevel,
            status: 'pending',
            decidedBy: null,
            decidedAt: null,
          }
        : null;
      apply((s) => ({
        ...s,
        aiDrafts: [draft, ...s.aiDrafts],
        approvals: approval ? [approval, ...s.approvals] : s.approvals,
        ledger: [created, ...s.ledger],
      }));
      return draft;
    },
    [apply, createActionLedgerEntry],
  );

  // Internal approval resolver shared by approveAiDraft / rejectAiDraft. Not exposed on
  // the store API — callers go through those typed wrappers.
  const decideApproval = useCallback(
    (id: string, decision: ApprovalDecision, opts?: { editedContent?: string; note?: string }) => {
      const appr = ref.current.approvals.find((a) => a.id === id);
      if (!appr) return;
      const role = ref.current.role;
      const decidedAt = nowIso();
      const released = decision === 'approved' || decision === 'edited';
      const proof = released
        ? buildProofEvent(
            {
              kind: 'approval',
              title: 'AI draft approved by human',
              detail: `${appr.itemType} reviewed and released as a simulated send.`,
              source: role,
              metric: { label: 'Decision', value: decision },
              relatedDraftId: appr.draftId,
              evidenceLabel: 'Approval record',
            },
            makeId('proof'),
            nowIso(),
          )
        : null;
      const decideLog = buildLedgerEntry(
        {
          actionType: 'approval.decided',
          actorType: 'human',
          actorId: role,
          subjectId: appr.draftId,
          summary: `${decision} ${appr.itemType}`,
          riskLevel: appr.riskLevel,
          approvalId: appr.id,
          proofEventId: proof?.id ?? null,
        },
        makeId('act'),
        nowIso(),
      );
      const sent = released
        ? buildLedgerEntry(
            {
              actionType: 'message.sent',
              actorType: 'system',
              actorId: 'sales-draft',
              subjectId: appr.draftId,
              summary: `Human-approved ${appr.itemType} released — simulated send.`,
              riskLevel: appr.riskLevel,
              proofEventId: proof?.id ?? null,
            },
            makeId('act'),
            nowIso(),
          )
        : null;
      apply((s) => ({
        ...s,
        approvals: s.approvals.map((a) =>
          a.id === id
            ? {
                ...a,
                status: decision,
                decidedBy: role,
                decidedAt,
                editedContent: opts?.editedContent,
                note: opts?.note,
              }
            : a,
        ),
        aiDrafts: opts?.editedContent
          ? s.aiDrafts.map((d) =>
              d.id === appr.draftId ? { ...d, content: opts.editedContent as string } : d,
            )
          : s.aiDrafts,
        ledger: [decideLog, ...(sent ? [sent] : []), ...s.ledger],
        proofEvents: proof ? [proof, ...s.proofEvents] : s.proofEvents,
      }));
    },
    [apply],
  );

  const approveAiDraft = useCallback(
    async (id: string, opts?: { editedContent?: string; note?: string }): Promise<void> => {
      const appr = ref.current.approvals.find((a) => a.id === id);
      const draft = appr ? ref.current.aiDrafts.find((d) => d.id === appr.draftId) : undefined;
      const lead =
        draft && draft.subjectId
          ? ref.current.leads.find((l) => l.id === draft.subjectId)
          : undefined;
      const body = opts?.editedContent ?? draft?.content ?? '';
      // Simulate the human-approved send through the adapter registry. Every mock
      // returns { simulated: true } — no real customer message is ever delivered.
      if (lead) {
        try {
          if (lead.consent.whatsapp) await adapters.whatsapp.sendMessage(lead.phone, body);
          else if (lead.consent.sms) await adapters.messaging.send('sms', lead.phone, body);
          else if (lead.consent.email) await adapters.messaging.send('email', lead.email, body);
          await adapters.crm.upsertLead(lead);
        } catch {
          // Simulated adapters never throw; ignore defensively.
        }
      }
      decideApproval(id, opts?.editedContent ? 'edited' : 'approved', opts);
    },
    [decideApproval],
  );

  const rejectAiDraft = useCallback(
    (id: string, opts?: { note?: string }) => {
      decideApproval(id, 'rejected', opts);
    },
    [decideApproval],
  );

  const createVehicle = useCallback(
    (v: Vehicle) => {
      apply((s) => {
        const exists = s.vehicles.some((x) => x.id === v.id);
        return {
          ...s,
          vehicles: exists ? s.vehicles.map((x) => (x.id === v.id ? v : x)) : [v, ...s.vehicles],
        };
      });
    },
    [apply],
  );

  const updateVehicle = useCallback(
    (id: string, patch: Partial<Vehicle>) => {
      apply((s) => ({
        ...s,
        vehicles: s.vehicles.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      }));
    },
    [apply],
  );

  const publishVehicle = useCallback(
    (id: string): { ok: boolean; reason?: string } => {
      const v = ref.current.vehicles.find((x) => x.id === id);
      if (!v) return { ok: false, reason: 'Vehicle not found.' };
      if (!v.sensitiveFieldsConfirmed)
        return {
          ok: false,
          reason: 'Confirm sensitive fields (price, accident history, warranty) before publishing.',
        };
      if (v.approvalStatus !== 'approved')
        return { ok: false, reason: 'Listing must be approved before publishing.' };
      const proof = buildProofEvent(
        {
          kind: 'publish',
          title: 'Vehicle published',
          detail: `${v.year} ${v.make} ${v.model} ${v.trim} published to the public site.`,
          source: ref.current.role,
          metric: { label: 'Stock', value: v.stockNumber ?? v.id },
          relatedVehicleId: v.id,
          evidenceLabel: 'Publish record',
        },
        makeId('proof'),
        nowIso(),
      );
      const act = buildLedgerEntry(
        {
          actionType: 'inventory.published',
          actorType: 'human',
          actorId: ref.current.role,
          subjectId: v.id,
          summary: `Published ${v.year} ${v.make} ${v.model}`,
          riskLevel: 'medium',
          proofEventId: proof.id,
        },
        makeId('act'),
        nowIso(),
      );
      apply((s) => ({
        ...s,
        vehicles: s.vehicles.map((x) => (x.id === id ? { ...x, publishedStatus: 'published' } : x)),
        proofEvents: [proof, ...s.proofEvents],
        ledger: [act, ...s.ledger],
      }));
      return { ok: true };
    },
    [apply],
  );

  const markVehicleSold = useCallback(
    (id: string): { ok: boolean; reason?: string } => {
      const v = ref.current.vehicles.find((x) => x.id === id);
      if (!v) return { ok: false, reason: 'Vehicle not found.' };
      if (!canMarkSold(v)) return { ok: false, reason: 'Vehicle is already marked sold.' };
      const now = nowIso();
      const label = `${v.year} ${v.make} ${v.model} ${v.trim}`.trim();
      const proof = buildProofEvent(
        {
          kind: 'outcome',
          title: 'Vehicle marked sold',
          detail: `${label} recorded as sold (simulated outcome).`,
          source: ref.current.role,
          metric: { label: 'Stock', value: v.stockNumber ?? v.id },
          relatedVehicleId: v.id,
          evidenceLabel: 'Sale record',
        },
        makeId('proof'),
        now,
      );
      const act = buildLedgerEntry(
        {
          actionType: 'inventory.sold',
          actorType: 'human',
          actorId: ref.current.role,
          subjectId: v.id,
          summary: `Marked ${label} sold`,
          riskLevel: 'low',
          proofEventId: proof.id,
        },
        makeId('act'),
        now,
      );
      apply((s) => ({
        ...s,
        vehicles: s.vehicles.map((x) => (x.id === id ? { ...x, availabilityStatus: 'sold' } : x)),
        proofEvents: [proof, ...s.proofEvents],
        ledger: [act, ...s.ledger],
      }));
      return { ok: true };
    },
    [apply],
  );

  const decideContentLike = useCallback(
    (kind: 'content' | 'social', id: string, decision: ApprovalDecision) => {
      const role = ref.current.role;
      const item =
        kind === 'content'
          ? ref.current.contentDrafts.find((c) => c.id === id)
          : ref.current.socialDrafts.find((c) => c.id === id);
      if (!item) return;
      const released = decision === 'approved' || decision === 'edited';
      const proof = released
        ? buildProofEvent(
            {
              kind: 'compliance_check',
              title: `${kind === 'content' ? 'Content' : 'Social post'} approved`,
              detail: `Reviewed for risky claims and released.`,
              source: role,
              metric: { label: 'Risk', value: item.riskLevel },
              evidenceLabel: 'Content approval',
            },
            makeId('proof'),
            nowIso(),
          )
        : null;
      const act = buildLedgerEntry(
        {
          actionType: released ? 'content.published' : 'approval.decided',
          actorType: 'human',
          actorId: role,
          subjectId: id,
          summary: `${decision} ${kind} draft`,
          riskLevel: item.riskLevel,
          proofEventId: proof?.id ?? null,
        },
        makeId('act'),
        nowIso(),
      );
      const nextStatus = released ? 'approved' : 'rejected';
      apply((s) => ({
        ...s,
        contentDrafts:
          kind === 'content'
            ? s.contentDrafts.map((c) => (c.id === id ? { ...c, approvalStatus: nextStatus } : c))
            : s.contentDrafts,
        socialDrafts:
          kind === 'social'
            ? s.socialDrafts.map((c) => (c.id === id ? { ...c, approvalStatus: nextStatus } : c))
            : s.socialDrafts,
        proofEvents: proof ? [proof, ...s.proofEvents] : s.proofEvents,
        ledger: [act, ...s.ledger],
      }));
    },
    [apply],
  );

  const decideContent = useCallback(
    (id: string, decision: ApprovalDecision) => decideContentLike('content', id, decision),
    [decideContentLike],
  );
  const decideSocial = useCallback(
    (id: string, decision: ApprovalDecision) => decideContentLike('social', id, decision),
    [decideContentLike],
  );

  const createGtmProspect = useCallback(
    (p: Omit<GTMProspect, 'id' | 'createdAt'>): GTMProspect => {
      const prospect: GTMProspect = { ...p, id: makeId('GP'), createdAt: nowIso() };
      apply((s) => ({ ...s, gtmProspects: [prospect, ...s.gtmProspects] }));
      return prospect;
    },
    [apply],
  );

  const saveDiscoverySession = useCallback(
    (answers: DiscoveryAnswers): DiscoverySession => {
      const now = nowIso();
      const session = discoverySessionFromAnswers(answers, makeId('DS'), now);
      const log = buildLedgerEntry(
        {
          actionType: 'discovery.completed',
          actorType: 'human',
          actorId: ref.current.role,
          subjectId: session.id,
          summary: `Discovery completed — ${session.dealership} (${session.recommendedPackage})`,
          riskLevel: 'low',
        },
        makeId('act'),
        now,
      );
      apply((s) => ({
        ...s,
        discoverySessions: [session, ...s.discoverySessions],
        ledger: [log, ...s.ledger],
      }));
      return session;
    },
    [apply],
  );

  const generateProposalFromDiscovery = useCallback(
    (session: DiscoverySession): { proposal: Proposal; prospect: GTMProspect } => {
      const now = nowIso();
      const proposal = proposalFromDiscovery(session.answers, session.id, makeId('PR'), now);
      const prospect = gtmProspectFromDiscovery(session.answers, makeId('GP'), now);
      const proof = buildProofEvent(
        {
          kind: 'report',
          title: 'Proposal generated from discovery',
          detail: `${proposal.recommendedPackage} proposal prepared for ${proposal.dealership}.`,
          source: ref.current.role,
          metric: { label: 'Package', value: proposal.recommendedPackage },
          evidenceLabel: 'Proposal record',
        },
        makeId('proof'),
        now,
      );
      const log = buildLedgerEntry(
        {
          actionType: 'proposal.generated',
          actorType: 'human',
          actorId: ref.current.role,
          subjectId: proposal.id,
          summary: `Proposal generated — ${proposal.dealership} (${proposal.recommendedPackage})`,
          riskLevel: 'low',
          proofEventId: proof.id,
        },
        makeId('act'),
        now,
      );
      apply((s) => ({
        ...s,
        proposals: [proposal, ...s.proposals],
        gtmProspects: [prospect, ...s.gtmProspects],
        proofEvents: [proof, ...s.proofEvents],
        ledger: [log, ...s.ledger],
      }));
      return { proposal, prospect };
    },
    [apply],
  );

  const createAppointment = useCallback(
    (a: Omit<Appointment, 'id'>): Appointment => {
      const appt: Appointment = { ...a, id: makeId('APT') };
      apply((s) => ({ ...s, appointments: [appt, ...s.appointments] }));
      return appt;
    },
    [apply],
  );

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState(seedState());
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ...state,
      mounted,
      createLead,
      updateLead,
      updateLeadStage,
      assignLead,
      createCustomer,
      updateCustomer,
      setRole,
      createProofEvent,
      createActionLedgerEntry,
      createAiDraft,
      createApproval,
      approveAiDraft,
      rejectAiDraft,
      createVehicle,
      updateVehicle,
      publishVehicle,
      markVehicleSold,
      decideContent,
      decideSocial,
      createGtmProspect,
      saveDiscoverySession,
      generateProposalFromDiscovery,
      createAppointment,
      resetDemo,
    }),
    [
      state,
      mounted,
      createLead,
      updateLead,
      updateLeadStage,
      assignLead,
      createCustomer,
      updateCustomer,
      setRole,
      createProofEvent,
      createActionLedgerEntry,
      createAiDraft,
      createApproval,
      approveAiDraft,
      rejectAiDraft,
      createVehicle,
      updateVehicle,
      publishVehicle,
      markVehicleSold,
      decideContent,
      decideSocial,
      createGtmProspect,
      saveDiscoverySession,
      generateProposalFromDiscovery,
      createAppointment,
      resetDemo,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
