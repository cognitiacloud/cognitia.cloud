/**
 * Shared, pure helpers for the integrated GTM operator demo route.
 *
 * The route's data is produced by the SERVER-ONLY adapter
 * `server/gtmIntegratedDemoData.ts`, which runs the real `@cognitia/agents`
 * modules (B1–B6). This file holds only presentation-agnostic helpers that the
 * adapter and tests reuse:
 *   - the persistent operator banner + sandbox constants,
 *   - a PII guard (mirrors `packages/agents` `assertNoRawPii`),
 *   - `canProceed`, the compliance+approval predicate.
 *
 * There is NO hand-authored scenario data here anymore — the previous
 * structural mirror was replaced by the real-module adapter.
 */

import type { GtmRunPacketView } from './gtmOsAssemblyViewModel';

/** Persistent operator banner — shown on every render of the demo route. */
export const DEMO_BANNER = 'MOCK ONLY / DRY-RUN ONLY / NO LIVE SEND / NO REAL CRM' as const;

export const SANDBOX_WORKSPACE = 'budget_wheels_demo' as const;

/** The single reason any live action is refused in this build. */
export const LIVE_BLOCKED_REASON =
  'Live channels are disabled by construction: no connector approval, no counsel/founder sign-off, no signed customer scope.';

// ---------------------------------------------------------------------------
// PII guard (mirrors packages/agents assertNoRawPii)
// ---------------------------------------------------------------------------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RESERVED_TLD = /\.(example|test|invalid)$/i;
const PHONE_RE = /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g;
const RESERVED_PHONE = /555[\s.-]?01\d{2}/;

/** Returns the first raw-PII fragment found, or null if the string is safe. */
export function findRawPii(value: string): string | null {
  for (const email of value.match(EMAIL_RE) ?? []) {
    if (email.includes('*')) continue; // masked
    const domain = email.slice(email.lastIndexOf('@') + 1);
    if (!RESERVED_TLD.test(domain)) return email;
  }
  for (const phone of value.match(PHONE_RE) ?? []) {
    if (!RESERVED_PHONE.test(phone)) return phone;
  }
  return null;
}

export function assertNoRawPii(value: string): void {
  const hit = findRawPii(value);
  if (hit) throw new Error(`raw PII detected: ${hit}`);
}

/** A lead can proceed only when compliance cleared AND a human approved. */
export function canProceed(packet: GtmRunPacketView): boolean {
  return (
    packet.compliance.passed && !packet.compliance.blocked && packet.approval.status === 'approved'
  );
}
