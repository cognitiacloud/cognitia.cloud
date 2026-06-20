// lib/normalize.ts
// Backward-compatible hydration merge for the demo store. Older localStorage
// snapshots (key `cognitia.demo.v2`) predate slices like `customers`,
// `consentEvents`, `discoverySessions`, `proposals`, and `integrations`. We must
// never assume a stored slice exists — for every key in the seed defaults we keep
// the stored value only when it is present AND shape-compatible, otherwise we fall
// back to the seed. Pure + generic so it is fully testable and SSR-safe.

/**
 * Merge a parsed localStorage snapshot over the seed defaults.
 * - Missing / null / undefined stored keys keep the default (new slices survive).
 * - Array slices keep the stored value only when it is itself an array.
 * - Scalars keep the stored value only when the runtime type matches the default.
 */
export function normalizeAppState<T extends object>(stored: unknown, defaults: T): T {
  if (stored === null || typeof stored !== 'object') return defaults;
  const s = stored as Record<string, unknown>;
  const out = { ...defaults } as T;
  for (const key of Object.keys(defaults) as Array<keyof T & string>) {
    const dv = (defaults as Record<string, unknown>)[key];
    const sv = s[key];
    if (sv === undefined || sv === null) continue;
    if (Array.isArray(dv)) {
      if (Array.isArray(sv)) (out as Record<string, unknown>)[key] = sv;
    } else if (typeof dv === typeof sv) {
      (out as Record<string, unknown>)[key] = sv;
    }
  }
  return out;
}
