// lib/ai-drafts.ts
// Deterministic "AI-assisted" draft generators. No external LLM and no randomness
// — the demo stays honest and testable. Every generated string is scanned by the
// guardrails; outbound drafts inherit requiresApproval from that scan, internal
// summaries never auto-gate. Production can swap these for a real model behind the
// same shape (and the same approval gate).
import type { Lead, Vehicle } from '../types';
import type { DraftKind } from '../types/portal';
import { scanSensitiveClaims, type ClaimType, type RiskLevel } from './guardrails';

export interface DraftBase {
  kind: DraftKind;
  content: string;
  claimTypes: ClaimType[];
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  rationale: string;
}

/** Drafts that would be sent/published externally (vs. internal summaries). */
const OUTBOUND: ReadonlySet<DraftKind> = new Set([
  'reply',
  'vehicle_listing',
  'seo_metadata',
  'social_caption',
  'reel_script',
]);

function build(kind: DraftKind, content: string, rationale: string): DraftBase {
  const scan = scanSensitiveClaims(content);
  return {
    kind,
    content,
    claimTypes: scan.claimTypes,
    riskLevel: scan.riskLevel,
    requiresApproval: OUTBOUND.has(kind) ? scan.requiresApproval : false,
    rationale,
  };
}

function vehicleLabel(v: Vehicle): string {
  return `${v.year} ${v.make} ${v.model} ${v.trim}`.trim();
}

/* ----------------------------------------------------------------------------
 * Lead-facing
 * --------------------------------------------------------------------------*/

/** Internal summary for the salesperson. Never auto-gated (not sent to a customer). */
export function generateLeadSummary(lead: Lead): DraftBase {
  const wants: string[] = [];
  if (lead.signals.appointmentRequested) wants.push('wants an appointment');
  if (lead.signals.financingRequested) wants.push('asked about financing');
  if (lead.signals.tradeInMentioned) wants.push('has a possible trade-in');
  if (lead.signals.budgetProvided && lead.budgetCad)
    wants.push(`budget ~$${lead.budgetCad.toLocaleString()}`);
  const interests = wants.length ? wants.join(', ') : 'early-stage interest';
  const content = [
    `${lead.name} • ${lead.source} • score ${lead.score} (${lead.stage}).`,
    `Interested in ${lead.vehicleInterest || 'inventory'}; ${interests}.`,
    `Recommended next step: ${lead.nextAction}.`,
  ].join('\n');
  return build(
    'lead_summary',
    content,
    'Internal summary from captured lead fields and score signals.',
  );
}

/** Safe customer reply. Sensitive topics (financing/trade-in) trigger the approval gate. */
export function generateSafeReplyDraft(lead: Lead): DraftBase {
  const vehicle = lead.vehicleInterest || 'the vehicle you asked about';
  const lines: string[] = [
    `Hi ${lead.name.split(' ')[0] || 'there'}, thanks for reaching out about ${vehicle}.`,
    `I'd love to help — may I get your name and best callback number in case we get disconnected?`,
  ];
  if (lead.signals.financingRequested) {
    lines.push(
      `On financing: we can review options with our team, and any approval is confirmed by the dealership or finance provider.`,
    );
  }
  if (lead.signals.tradeInMentioned) {
    lines.push(
      `For your trade-in, I can collect the details for review — a value is confirmed after the dealership reviews the vehicle.`,
    );
  }
  lines.push(`What day and time would work best for a quick call or visit?`);
  const content = lines.join('\n\n');
  return build(
    'reply',
    content,
    'Drafted from lead context. No pricing, financing, or trade-in values are committed — a human must review and send.',
  );
}

/* ----------------------------------------------------------------------------
 * Inventory + marketing
 * --------------------------------------------------------------------------*/

export function generateVehicleListingDraft(v: Vehicle): DraftBase {
  const label = vehicleLabel(v);
  const content = [
    `${label} — ${v.bodyType}, ${v.drivetrain}`,
    ``,
    `This ${v.year} ${v.make} ${v.model} comes in ${v.exteriorColor} with ${v.odometerKm.toLocaleString()} km on a ${v.transmission} ${v.fuelType.toLowerCase()} drivetrain.`,
    v.badges.length ? `Highlights: ${v.badges.join(', ')}.` : '',
    ``,
    `Pricing, availability, warranty, accident history, and trade-in details are confirmed with the dealership.`,
  ]
    .filter(Boolean)
    .join('\n');
  return build(
    'vehicle_listing',
    content,
    'Listing copy from confirmed spec fields only. Sensitive fields require attestation before publish.',
  );
}

export function generateSeoMetadataDraft(v: Vehicle, location?: string): DraftBase {
  const label = vehicleLabel(v);
  const where = location ? ` in ${location}` : '';
  const title = `${label} for Sale${where} | Used ${v.bodyType}`.slice(0, 60);
  const description =
    `Explore this ${v.year} ${v.make} ${v.model} ${v.trim} (${v.odometerKm.toLocaleString()} km)${where}. ` +
    `Book a test drive or ask us to confirm current availability and pricing.`.slice(0, 160);
  const content = `Title: ${title}\nDescription: ${description}`;
  return build(
    'seo_metadata',
    content,
    'Search-visibility foundation only. No ranking or inclusion is promised.',
  );
}

export function generateSocialCaptionDraft(
  v: Vehicle,
  platform: string,
  city = 'your city',
): DraftBase {
  const label = vehicleLabel(v);
  const content = [
    `${label} available in ${city}.`,
    ``,
    `Highlights:`,
    `• ${v.odometerKm.toLocaleString()} km`,
    ...v.badges.slice(0, 2).map((b) => `• ${b}`),
    ``,
    `Interested? Message us to check current availability or book a viewing.`,
    ``,
    `Availability, pricing, financing, warranty, and trade-in details should be confirmed with the dealership.`,
    ``,
    `#${v.make}${v.model} #UsedCars #${platform}`,
  ].join('\n');
  return build(
    'social_caption',
    content,
    `Caption for ${platform}. Availability/pricing wording is conservative and requires approval before posting.`,
  );
}

export function generateReelScriptDraft(v: Vehicle): DraftBase {
  const label = vehicleLabel(v);
  const content = [
    `Reel script — ${label}`,
    `1. Hook (0-2s): "Looking for a ${v.bodyType}? Watch this."`,
    `2. Walkaround (2-8s): exterior in ${v.exteriorColor}, ${v.odometerKm.toLocaleString()} km.`,
    `3. Value (8-14s): ${v.badges.join(', ') || 'clean, inspected, ready'}.`,
    `4. CTA (14-18s): "Message us to confirm availability or book a viewing."`,
    ``,
    `On-screen disclaimer: details confirmed with the dealership.`,
  ].join('\n');
  return build(
    'reel_script',
    content,
    'Short-form script outline. No price or promo claims baked in.',
  );
}
