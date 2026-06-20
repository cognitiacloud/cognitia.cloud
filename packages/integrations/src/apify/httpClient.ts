import type { ApifyClient, ApifyDatasetItem, ApifyRunResult, ApifyRunStatus } from './types.js';

/**
 * Live Apify transport. This is the ONLY file in the apify module permitted to
 * touch the network (the guard test enforces that). It is constructed only on
 * the gated live path (token + allow-network + policy). The token is read from
 * config, never logged, never persisted, and never placed in error messages.
 *
 * Lifecycle (official async semantics, not the non-deterministic last-run):
 *   POST acts/{actorId}/runs → poll actor-runs/{id} until terminal →
 *   GET datasets/{datasetId}/items (paginated, capped at the effective max).
 */

/** Minimal fetch surface so we don't depend on a DOM lib (mirrors HubSpot). */
export interface ApifyHttpResponse {
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
export interface ApifyHttpRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}
export type ApifyHttpFetch = (
  url: string,
  init?: ApifyHttpRequestInit,
) => Promise<ApifyHttpResponse>;

export interface HttpApifyClientOptions {
  /** Apify API token. Never logged or surfaced in errors. */
  token: string;
  fetch: ApifyHttpFetch;
  baseUrl?: string;
  /** Items per dataset page request. Default 100. */
  pageLimit?: number;
  /** Injected sleep so polling doesn't actually wait in tests. */
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
}

/** Error carrying only a status + sanitized detail (never the token/URL/query). */
export class ApifyHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    detail: string,
  ) {
    super(`apify api error ${status} at ${path}: ${detail}`);
    this.name = 'ApifyHttpError';
  }
}

const DEFAULT_BASE = 'https://api.apify.com/v2';
const TERMINAL: ReadonlySet<ApifyRunStatus> = new Set([
  'SUCCEEDED',
  'FAILED',
  'TIMED-OUT',
  'ABORTED',
]);

export class HttpApifyClient implements ApifyClient {
  private readonly token: string;
  private readonly fetch: ApifyHttpFetch;
  private readonly base: string;
  private readonly pageLimit: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pollIntervalMs: number;

  constructor(opts: HttpApifyClientOptions) {
    this.token = opts.token;
    this.fetch = opts.fetch;
    this.base = opts.baseUrl ?? DEFAULT_BASE;
    this.pageLimit = opts.pageLimit ?? 100;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.pollIntervalMs = opts.pollIntervalMs ?? 1000;
  }

  /** actorId "apify/website-content-crawler" → path segment "apify~website-content-crawler". */
  private actorPath(actorId: string): string {
    return actorId.replace('/', '~');
  }

  private withToken(path: string, query: Record<string, string | number> = {}): string {
    const params = new URLSearchParams({ token: this.token });
    for (const [k, v] of Object.entries(query)) params.set(k, String(v));
    return `${this.base}${path}?${params.toString()}`;
  }

  private async getJson(path: string, query: Record<string, string | number>): Promise<unknown> {
    const res = await this.fetch(this.withToken(path, query), { method: 'GET' });
    if (res.status < 200 || res.status >= 300) {
      throw new ApifyHttpError(res.status, path, await safeDetail(res));
    }
    return res.json();
  }

  async runActor(req: {
    actorId: string;
    input: Record<string, unknown>;
    maxItems: number;
    timeoutMs: number;
  }): Promise<ApifyRunResult> {
    const startPath = `/acts/${this.actorPath(req.actorId)}/runs`;
    const startRes = await this.fetch(this.withToken(startPath), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.input ?? {}),
    });
    if (startRes.status < 200 || startRes.status >= 300) {
      throw new ApifyHttpError(startRes.status, startPath, await safeDetail(startRes));
    }
    const started = (await startRes.json()) as { data?: RunData };
    const runId = started.data?.id;
    if (!runId) throw new ApifyHttpError(startRes.status, startPath, 'missing run id');

    const final = await this.pollRun(runId, req.timeoutMs);
    const datasetId = final.defaultDatasetId;
    const datasetItems =
      final.status === 'SUCCEEDED' && datasetId
        ? await this.listDatasetItems(datasetId, { limit: req.maxItems })
        : [];

    return {
      providerRunId: runId,
      defaultDatasetId: datasetId ?? '',
      status: final.status,
      startedAt: final.startedAt ?? new Date().toISOString(),
      finishedAt: final.finishedAt ?? null,
      itemCount: datasetItems.length,
      datasetItems,
    };
  }

  async getRun(providerRunId: string): Promise<ApifyRunResult> {
    const data = await this.fetchRun(providerRunId);
    const datasetId = data.defaultDatasetId;
    const datasetItems =
      data.status === 'SUCCEEDED' && datasetId
        ? await this.listDatasetItems(datasetId, { limit: this.pageLimit })
        : [];
    return {
      providerRunId,
      defaultDatasetId: datasetId ?? '',
      status: data.status,
      startedAt: data.startedAt ?? new Date().toISOString(),
      finishedAt: data.finishedAt ?? null,
      itemCount: datasetItems.length,
      datasetItems,
    };
  }

  /** Paginated dataset read, hard-capped at `limit` (the effective max). */
  async listDatasetItems(datasetId: string, opts: { limit: number }): Promise<ApifyDatasetItem[]> {
    const cap = Math.max(0, opts.limit);
    const out: ApifyDatasetItem[] = [];
    let offset = 0;
    while (out.length < cap) {
      const pageSize = Math.min(this.pageLimit, cap - out.length);
      const page = (await this.getJson(`/datasets/${datasetId}/items`, {
        clean: 'true',
        offset,
        limit: pageSize,
      })) as ApifyDatasetItem[] | { items?: ApifyDatasetItem[] };
      const items = Array.isArray(page) ? page : (page.items ?? []);
      if (items.length === 0) break;
      out.push(...items);
      offset += items.length;
      if (items.length < pageSize) break;
    }
    return out.slice(0, cap);
  }

  private async fetchRun(runId: string): Promise<RunData> {
    const data = (await this.getJson(`/actor-runs/${runId}`, {})) as { data?: RunData };
    if (!data.data) throw new ApifyHttpError(200, `/actor-runs/${runId}`, 'missing run data');
    return data.data;
  }

  private async pollRun(runId: string, timeoutMs: number): Promise<RunData> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    // First read is immediate; loop until terminal or timeout.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const data = await this.fetchRun(runId);
      if (TERMINAL.has(data.status)) return data;
      if (Date.now() >= deadline) return { ...data, status: 'TIMED-OUT' };
      await this.sleep(this.pollIntervalMs);
    }
  }
}

interface RunData {
  id?: string;
  status: ApifyRunStatus;
  defaultDatasetId?: string;
  startedAt?: string;
  finishedAt?: string | null;
}

/** Read a short error detail without leaking secrets; never includes the URL/token. */
async function safeDetail(res: ApifyHttpResponse): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 200);
  } catch {
    return 'unreadable error body';
  }
}
