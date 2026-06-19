// lib/metrics.ts
// Deterministic dashboard KPI derivation from the current lead set.
// "Today" is the most recent calendar date present in the data, so the numbers
// stay sensible regardless of the wall clock during a demo.

import type { Lead } from '../types';
import { SLA_TARGET_MINUTES } from './constants';

export interface DashboardKpis {
  newLeadsToday: number;
  avgResponseMinutes: number;
  appointmentsBooked: number;
  qualifiedLeads: number;
  missedSla: number;
  slaTargetMinutes: number;
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function latestDay(leads: Lead[]): string {
  return leads.reduce((max, l) => {
    const d = dayOf(l.createdAt);
    return d > max ? d : max;
  }, '');
}

export function computeKpis(leads: Lead[]): DashboardKpis {
  const today = latestDay(leads);

  const newLeadsToday = leads.filter((l) => dayOf(l.createdAt) === today).length;

  const responded = leads.filter((l) => typeof l.firstResponseMinutes === 'number') as (Lead & {
    firstResponseMinutes: number;
  })[];
  const avgResponseMinutes = responded.length
    ? Math.round(responded.reduce((sum, l) => sum + l.firstResponseMinutes, 0) / responded.length)
    : 0;

  const appointmentsBooked = leads.filter((l) => l.signals.appointmentRequested).length;

  const qualifiedLeads = leads.filter((l) => l.score >= 31).length;

  const missedSla = leads.filter(
    (l) => l.firstResponseMinutes === null || l.firstResponseMinutes > SLA_TARGET_MINUTES,
  ).length;

  return {
    newLeadsToday,
    avgResponseMinutes,
    appointmentsBooked,
    qualifiedLeads,
    missedSla,
    slaTargetMinutes: SLA_TARGET_MINUTES,
  };
}
