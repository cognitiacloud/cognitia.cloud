'use client';

// lib/store/AppStateProvider.tsx
// Single demo store for the whole Auto Growth OS. Seeded from data/*.json
// (deterministic for SSR), hydrated from localStorage after mount, persisted on
// every mutation. Server components read seed JSON directly; only interactive
// client pages consume this provider. All ids/timestamps are created inside
// actions (never during render) so SSR stays deterministic.

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Lead, LeadFormInput, ScoringSignals, Stage, Vehicle } from '@/types';
import type {
  AIDraft,
  ActionLedgerEntry,
  Appointment,
  Approval,
  ApprovalDecision,
  ContentDraft,
  DraftKind,
  GTMProspect,
  ProofEvent,
  RoleId,
  SocialPostDraft,
} from '@/types/portal';
import { scoreAndStage } from '@/lib/scoring';
import { canAgentPerform } from '@/lib/agents';
import { generateLeadSummary, generateSafeReplyDraft } from '@/lib/ai-drafts';
import { createLedgerEntry, createProofEvent } from '@/lib/proof';
import { makeId, nowIso } from '@/lib/id';
import leadsRaw from '@/data/leads.json';
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

interface DemoState {
  role: RoleId;
  leads: Lead[];
  vehicles: Vehicle[];
  aiDrafts: AIDraft[];
  approvals: Approval[];
  ledger: ActionLedgerEntry[];
  proofEvents: ProofEvent[];
  appointments: Appointment[];
  contentDrafts: ContentDraft[];
  socialDrafts: SocialPostDraft[];
  gtmProspects: GTMProspect[];
}

function seedState(): DemoState {
  return {
    role: DEFAULT_ROLE,
    leads: leadsRaw as Lead[],
    vehicles: vehiclesRaw as Vehicle[],
    aiDrafts: aiDraftsRaw as AIDraft[],
    approvals: approvalsRaw as Approval[],
    ledger: ledgerRaw as ActionLedgerEntry[],
    proofEvents: proofRaw as ProofEvent[],
    appointments: appointmentsRaw as Appointment[],
    contentDrafts: contentRaw as ContentDraft[],
    socialDrafts: socialRaw as SocialPostDraft[],
    gtmProspects: prospectsRaw as GTMProspect[],
  };
}

export interface AppState extends DemoState {
  /** False during SSR and first client render; true after hydration. */
  mounted: boolean;
  // leads
  addLead: (input: LeadFormInput) => Lead;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  // governance / spine
  setRole: (role: RoleId) => void;
  recordProof: (e: Omit<ProofEvent, 'id' | 'createdAt'>) => ProofEvent;
  logAction: (e: Omit<ActionLedgerEntry, 'id' | 'createdAt'>) => ActionLedgerEntry;
  generateDraftFor: (leadId: string, kind?: DraftKind) => AIDraft | null;
  decideApproval: (
    id: string,
    decision: ApprovalDecision,
    opts?: { editedContent?: string; note?: string },
  ) => void;
  // inventory + content
  upsertVehicle: (v: Vehicle) => void;
  publishVehicle: (id: string) => { ok: boolean; reason?: string };
  decideContent: (id: string, decision: ApprovalDecision) => void;
  decideSocial: (id: string, decision: ApprovalDecision) => void;
  // demandara gtm + appointments
  addProspect: (p: Omit<GTMProspect, 'id' | 'createdAt'>) => GTMProspect;
  addAppointment: (a: Omit<Appointment, 'id'>) => Appointment;
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

function buildLead(input: LeadFormInput): Lead {
  const signals: ScoringSignals = {
    appointmentRequested: input.appointmentRequested,
    financingRequested: input.financingRequested,
    tradeInMentioned: input.tradeInMentioned,
    budgetProvided: typeof input.budgetCad === 'number' && input.budgetCad > 0,
    respondToday: input.respondToday,
    specificVehicleSelected: Boolean(input.vehicleId),
  };
  const { score, stage } = scoreAndStage(signals);
  const now = nowIso();
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
        const p = JSON.parse(raw) as Partial<DemoState>;
        setState((prev) => ({
          role: p.role ?? prev.role,
          leads: Array.isArray(p.leads) ? (p.leads as Lead[]) : prev.leads,
          vehicles: Array.isArray(p.vehicles) ? (p.vehicles as Vehicle[]) : prev.vehicles,
          aiDrafts: Array.isArray(p.aiDrafts) ? (p.aiDrafts as AIDraft[]) : prev.aiDrafts,
          approvals: Array.isArray(p.approvals) ? (p.approvals as Approval[]) : prev.approvals,
          ledger: Array.isArray(p.ledger) ? (p.ledger as ActionLedgerEntry[]) : prev.ledger,
          proofEvents: Array.isArray(p.proofEvents)
            ? (p.proofEvents as ProofEvent[])
            : prev.proofEvents,
          appointments: Array.isArray(p.appointments)
            ? (p.appointments as Appointment[])
            : prev.appointments,
          contentDrafts: Array.isArray(p.contentDrafts)
            ? (p.contentDrafts as ContentDraft[])
            : prev.contentDrafts,
          socialDrafts: Array.isArray(p.socialDrafts)
            ? (p.socialDrafts as SocialPostDraft[])
            : prev.socialDrafts,
          gtmProspects: Array.isArray(p.gtmProspects)
            ? (p.gtmProspects as GTMProspect[])
            : prev.gtmProspects,
        }));
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

  const recordProof = useCallback(
    (e: Omit<ProofEvent, 'id' | 'createdAt'>): ProofEvent => {
      const ev = createProofEvent(e, makeId('proof'), nowIso());
      apply((s) => ({ ...s, proofEvents: [ev, ...s.proofEvents] }));
      return ev;
    },
    [apply],
  );

  const logAction = useCallback(
    (e: Omit<ActionLedgerEntry, 'id' | 'createdAt'>): ActionLedgerEntry => {
      const a = createLedgerEntry(e, makeId('act'), nowIso());
      apply((s) => ({ ...s, ledger: [a, ...s.ledger] }));
      return a;
    },
    [apply],
  );

  const addLead = useCallback(
    (input: LeadFormInput): Lead => {
      const lead = buildLead(input);
      const captured = createProofEvent(
        {
          kind: 'lead_captured',
          title: `Lead captured — ${lead.name}`,
          detail: `${lead.source} • ${lead.vehicleInterest}`,
          source: 'public_form',
          relatedLeadId: lead.id,
          evidenceLabel: 'Form submission',
        },
        makeId('proof'),
        nowIso(),
      );
      const responded = createProofEvent(
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
        nowIso(),
      );
      const a1 = createLedgerEntry(
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
        nowIso(),
      );
      const a2 = createLedgerEntry(
        {
          actionType: 'lead.scored',
          actorType: 'agent',
          actorId: 'lead-intake',
          subjectId: lead.id,
          summary: `Scored ${lead.score} → ${lead.stage}`,
          riskLevel: 'low',
        },
        makeId('act'),
        nowIso(),
      );
      apply((s) => ({
        ...s,
        leads: [lead, ...s.leads],
        proofEvents: [responded, captured, ...s.proofEvents],
        ledger: [a2, a1, ...s.ledger],
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

  const setRole = useCallback((role: RoleId) => apply((s) => ({ ...s, role })), [apply]);

  const generateDraftFor = useCallback(
    (leadId: string, kind: DraftKind = 'reply'): AIDraft | null => {
      const lead = ref.current.leads.find((l) => l.id === leadId);
      if (!lead) return null;
      const action = kind === 'lead_summary' ? 'summarize_lead' : 'draft_reply';
      if (!canAgentPerform('sales-draft', action)) {
        logAction({
          actionType: 'agent.blocked',
          actorType: 'system',
          actorId: 'sales-draft',
          subjectId: leadId,
          summary: 'Auto action blocked by agent policy — human required.',
          riskLevel: 'high',
        });
        return null;
      }
      const base =
        kind === 'lead_summary' ? generateLeadSummary(lead) : generateSafeReplyDraft(lead);
      const draft: AIDraft = {
        id: makeId('draft'),
        kind: base.kind,
        channel: 'whatsapp',
        agentId: 'sales-draft',
        subjectId: lead.id,
        subjectLabel: `${lead.name} · ${lead.vehicleInterest}`,
        content: base.content,
        claimTypes: base.claimTypes,
        riskLevel: base.riskLevel,
        requiresApproval: base.requiresApproval,
        rationale: base.rationale,
        createdAt: nowIso(),
      };
      const created = createLedgerEntry(
        {
          actionType: 'draft.created',
          actorType: 'agent',
          actorId: 'sales-draft',
          subjectId: draft.id,
          summary: `Drafted ${draft.kind} for ${lead.name}`,
          riskLevel: draft.riskLevel,
        },
        makeId('act'),
        nowIso(),
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
    [apply, logAction],
  );

  const decideApproval = useCallback(
    (id: string, decision: ApprovalDecision, opts?: { editedContent?: string; note?: string }) => {
      const appr = ref.current.approvals.find((a) => a.id === id);
      if (!appr) return;
      const role = ref.current.role;
      const decidedAt = nowIso();
      const released = decision === 'approved' || decision === 'edited';
      const proof = released
        ? createProofEvent(
            {
              kind: 'approval',
              title: 'AI draft approved by human',
              detail: `${appr.itemType} reviewed and released.`,
              source: role,
              metric: { label: 'Decision', value: decision },
              relatedDraftId: appr.draftId,
              evidenceLabel: 'Approval record',
            },
            makeId('proof'),
            nowIso(),
          )
        : null;
      const decideLog = createLedgerEntry(
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
        ? createLedgerEntry(
            {
              actionType: 'message.sent',
              actorType: 'system',
              actorId: 'sales-draft',
              subjectId: appr.draftId,
              summary: 'Approved item released (simulated).',
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

  const upsertVehicle = useCallback(
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
      const proof = createProofEvent(
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
      const act = createLedgerEntry(
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
        ? createProofEvent(
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
      const act = createLedgerEntry(
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

  const addProspect = useCallback(
    (p: Omit<GTMProspect, 'id' | 'createdAt'>): GTMProspect => {
      const prospect: GTMProspect = { ...p, id: makeId('GP'), createdAt: nowIso() };
      apply((s) => ({ ...s, gtmProspects: [prospect, ...s.gtmProspects] }));
      return prospect;
    },
    [apply],
  );

  const addAppointment = useCallback(
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
      addLead,
      updateLead,
      setRole,
      recordProof,
      logAction,
      generateDraftFor,
      decideApproval,
      upsertVehicle,
      publishVehicle,
      decideContent,
      decideSocial,
      addProspect,
      addAppointment,
      resetDemo,
    }),
    [
      state,
      mounted,
      addLead,
      updateLead,
      setRole,
      recordProof,
      logAction,
      generateDraftFor,
      decideApproval,
      upsertVehicle,
      publishVehicle,
      decideContent,
      decideSocial,
      addProspect,
      addAppointment,
      resetDemo,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
