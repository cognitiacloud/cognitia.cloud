/** Typed surface of smoke-deploy.mjs for the vitest suite (single source of truth is the .mjs). */
export interface SmokeCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  detail: string;
  required: boolean;
}
export interface SmokeFetchResponse {
  status: number;
  json(): Promise<unknown>;
}
export type SmokeFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<SmokeFetchResponse>;
export function runSmoke(opts: {
  baseUrl: string;
  fetchLike: SmokeFetch;
  operatorToken?: string;
  viewerToken?: string;
}): Promise<{ checks: SmokeCheck[]; ok: boolean }>;
