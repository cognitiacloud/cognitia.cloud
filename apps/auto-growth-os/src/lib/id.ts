// lib/id.ts
// Tiny id helper for demo records. Only ever called from client event handlers /
// store actions (never during render) so SSR output stays deterministic.
let counter = 0;

export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
