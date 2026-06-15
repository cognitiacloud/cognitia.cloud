import type { AccountRow } from '@cognitia/db';

export interface IcpCriteria {
  industries?: string[];
  minEmployees?: number;
  maxEmployees?: number;
  regions?: string[];
}

export interface AccountScore {
  fit: number; // 0..1
  timing: number; // 0..1
  combined: number; // 0..1
}

/**
 * Fit/timing scoring v0 — deterministic heuristic, no LLM. Fit measures ICP
 * match; timing uses any precomputed timing_score (signal-derived) falling back
 * to a neutral prior. Combined is a weighted blend used for ranking.
 */
export function scoreAccount(account: AccountRow, icp: IcpCriteria = {}): AccountScore {
  let fit = 0.5; // neutral prior
  let matches = 0;
  let checks = 0;

  if (icp.industries && icp.industries.length > 0) {
    checks++;
    if (account.industry && icp.industries.includes(account.industry)) matches++;
  }
  if (icp.minEmployees !== undefined || icp.maxEmployees !== undefined) {
    checks++;
    const n = account.employee_count ?? 0;
    const okMin = icp.minEmployees === undefined || n >= icp.minEmployees;
    const okMax = icp.maxEmployees === undefined || n <= icp.maxEmployees;
    if (okMin && okMax) matches++;
  }
  if (icp.regions && icp.regions.length > 0) {
    checks++;
    if (account.region && icp.regions.includes(account.region)) matches++;
  }
  if (checks > 0) {
    fit = matches / checks;
  } else if (account.fit_score != null) {
    fit = clamp01(account.fit_score);
  }

  const timing = account.timing_score != null ? clamp01(account.timing_score) : 0.5;
  const combined = clamp01(0.6 * fit + 0.4 * timing);
  return { fit: round(fit), timing: round(timing), combined: round(combined) };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
