// lib/format.ts
// Small, dependency-free formatting helpers (CAD currency, ranges, dates).

import type { Range } from '../types';

const cad0 = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

/** $24,900 */
export function formatCad(amount: number): string {
  return cad0.format(amount);
}

/** Compact CAD for ranges, e.g. $3.5k or $12k. */
export function formatCadShort(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    const text = Number.isInteger(k) ? String(k) : k.toFixed(1);
    return `$${text}k`;
  }
  return `$${amount}`;
}

/** "$3k–$7k" */
export function formatRange(range: Range): string {
  if (range.min === range.max) return formatCadShort(range.min);
  return `${formatCadShort(range.min)}–${formatCadShort(range.max)}`;
}

/** "84,200 km" */
export function formatKm(km: number): string {
  return `${new Intl.NumberFormat('en-CA').format(km)} km`;
}

/** Relative "time ago" from an ISO string, anchored to now. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((now.getTime() - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** "Aug 12, 2024" — formatted in UTC so server and client always agree. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Minutes → "4 min" or "1 hr 5 min". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
