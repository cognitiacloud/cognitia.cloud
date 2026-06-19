'use client';

// lib/store/AppStateProvider.tsx
// Demo state: seeded from data/leads.json (deterministic for SSR), then hydrated
// from localStorage after mount so leads survive navigation and hard refresh.

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lead, LeadFormInput, ScoringSignals, Stage } from '@/types';
import { scoreAndStage } from '@/lib/scoring';
import leadsRaw from '@/data/leads.json';

const SEED_LEADS = leadsRaw as Lead[];
const STORAGE_KEY = 'cognitia.leads.v1';

export interface AppState {
  leads: Lead[];
  /** False during SSR and first client render; true after hydration. */
  mounted: boolean;
  addLead: (input: LeadFormInput) => Lead;
  updateLead: (id: string, patch: Partial<Lead>) => void;
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
  const now = new Date().toISOString();
  const anyConsent = input.consent.email || input.consent.sms || input.consent.whatsapp;

  return {
    id: `LD-${Date.now()}`,
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
    // Simulated instant auto-acknowledgement keeps SLA honest for fresh leads.
    firstResponseMinutes: 1,
    createdAt: now,
    isDemo: true,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(SEED_LEADS);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after first paint (no SSR mismatch).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Lead[];
        if (Array.isArray(parsed) && parsed.length) setLeads(parsed);
      }
    } catch {
      // Corrupt/blocked storage → fall back to seed silently.
    }
    setMounted(true);
  }, []);

  const persist = useCallback((next: Lead[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write failures (private mode, quota).
    }
  }, []);

  const addLead = useCallback(
    (input: LeadFormInput): Lead => {
      const lead = buildLead(input);
      setLeads((prev) => {
        const next = [lead, ...prev];
        persist(next);
        return next;
      });
      return lead;
    },
    [persist],
  );

  const updateLead = useCallback(
    (id: string, patch: Partial<Lead>) => {
      setLeads((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
    setLeads(SEED_LEADS);
  }, []);

  const value = useMemo<AppState>(
    () => ({ leads, mounted, addLead, updateLead, resetDemo }),
    [leads, mounted, addLead, updateLead, resetDemo],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
