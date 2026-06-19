// lib/constants.ts
// Brand strings, SLA targets, scoring weights, and shared data-layer labels.

import type { ScoringSignals, Stage } from '../types';

export const BRAND = {
  name: 'Cognitia',
  product: 'Auto Growth OS',
  tagline: 'The dealership growth operating system.',
  email: 'hello@cognitia.cloud',
  phone: '+1 (000) 000-0000',
} as const;

/** Weight applied to each scoring signal (sums to a 0–100 scale). */
export const SCORE_WEIGHTS: Record<keyof ScoringSignals, number> = {
  appointmentRequested: 25,
  financingRequested: 20,
  tradeInMentioned: 20,
  budgetProvided: 15,
  respondToday: 10,
  specificVehicleSelected: 10,
};

/** Human-readable label for each signal, used in the "why this score" panel. */
export const SIGNAL_LABELS: Record<keyof ScoringSignals, string> = {
  appointmentRequested: 'Appointment requested',
  financingRequested: 'Financing requested',
  tradeInMentioned: 'Trade-in mentioned',
  budgetProvided: 'Budget provided',
  respondToday: 'Wants a response today',
  specificVehicleSelected: 'Specific vehicle selected',
};

/** Inclusive lower bound for each stage; ordered low → high. */
export const STAGE_THRESHOLDS: { min: number; stage: Stage }[] = [
  { min: 86, stage: 'Immediate Sales Handoff' },
  { min: 61, stage: 'Hot Lead' },
  { min: 31, stage: 'Qualified' },
  { min: 0, stage: 'Nurture' },
];

export const STAGE_ORDER: Stage[] = ['Nurture', 'Qualified', 'Hot Lead', 'Immediate Sales Handoff'];

/** Service-level target for first response, in minutes. */
export const SLA_TARGET_MINUTES = 5;

/** Labels for the shared customer-intelligence data layer (system map). */
export const DATA_LAYER = [
  'Consent',
  'Preferences',
  'Vehicles owned',
  'Family context',
  'Conversation history',
  'Buying signals',
  'Service dates',
  'Next best action',
] as const;

/** The growth pipeline stages shown on the system map. */
export const PIPELINE = [
  { key: 'traffic', label: 'Traffic', blurb: 'Ads, organic, referrals, walk-ins' },
  { key: 'capture', label: 'Capture', blurb: 'Forms, WhatsApp, click-to-call' },
  { key: 'qualify', label: 'Qualify', blurb: 'Local lead scoring + routing' },
  { key: 'nurture', label: 'Nurture', blurb: 'Consent-based follow-up sequences' },
  { key: 'book', label: 'Book', blurb: 'Test drives + financing consults' },
  { key: 'close', label: 'Close', blurb: 'Sales handoff with full context' },
  { key: 'retain', label: 'Retain', blurb: 'Service, rapport, repurchase window' },
] as const;

/** Primary site navigation. */
export const NAV_LINKS = [
  { href: '/', label: 'Dealership' },
  { href: '/intake', label: 'Intake' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/customer-mapper', label: 'Customer Mapper' },
  { href: '/modules', label: 'Modules' },
  { href: '/system-map', label: 'System Map' },
] as const;

/** The six compliance commitments surfaced across the app. */
export const COMPLIANCE_POINTS = [
  {
    title: 'CASL-ready consent tracking',
    body: 'Express and implied consent is captured and time-stamped for every commercial message.',
  },
  {
    title: 'Unsubscribe on every channel',
    body: 'One-click unsubscribe for email and SMS campaigns, honoured automatically.',
  },
  {
    title: 'Internal do-not-call suppression',
    body: 'Suppression lists are enforced before any outbound contact is queued.',
  },
  {
    title: 'Human approval gates for AI',
    body: 'AI agents draft; a human approves. No message leaves without sign-off.',
  },
  {
    title: 'No autonomous promises',
    body: 'AI never commits to discounts, financing, legal, or warranty terms on its own.',
  },
  {
    title: 'Data minimization & access control',
    body: 'We store only what the workflow needs, behind role-based access.',
  },
] as const;
