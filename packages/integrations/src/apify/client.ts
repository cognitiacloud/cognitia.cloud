import type { ApifyClient, ApifyDatasetItem, ApifyRunResult } from './types.js';
import { getFixtureDataset } from './fixtures.js';

export type { ApifyClient } from './types.js';

export interface FakeApifyClientOptions {
  /** Override datasets per actorId; falls back to built-in fixtures. */
  datasetsByActor?: Record<string, ApifyDatasetItem[]>;
  /** Simulate an actor run that fails (for failed-run lifecycle tests). */
  failRun?: boolean;
}

/**
 * In-memory ApifyClient for fixture mode and tests. Makes NO network calls.
 * Honors the effective max-items cap by slicing the dataset (mirrors the live
 * client's pagination stop). Deterministic ids for assertions.
 */
export class FakeApifyClient implements ApifyClient {
  private readonly datasetsByActor: Record<string, ApifyDatasetItem[]>;
  private readonly failRun: boolean;
  private seq = 0;
  private readonly datasets = new Map<string, ApifyDatasetItem[]>();

  constructor(opts: FakeApifyClientOptions = {}) {
    this.datasetsByActor = opts.datasetsByActor ?? {};
    this.failRun = opts.failRun ?? false;
  }

  async runActor(req: {
    actorId: string;
    input: Record<string, unknown>;
    maxItems: number;
    timeoutMs: number;
  }): Promise<ApifyRunResult> {
    this.seq += 1;
    const providerRunId = `fake-run-${this.seq}`;
    const defaultDatasetId = `fake-dataset-${this.seq}`;
    const startedAt = new Date(0).toISOString();
    if (this.failRun) {
      return {
        providerRunId,
        defaultDatasetId,
        status: 'FAILED',
        startedAt,
        finishedAt: startedAt,
        itemCount: 0,
        datasetItems: [],
      };
    }
    const all = this.datasetsByActor[req.actorId] ?? getFixtureDataset(req.actorId);
    const items = all.slice(0, Math.max(0, req.maxItems));
    this.datasets.set(defaultDatasetId, items);
    return {
      providerRunId,
      defaultDatasetId,
      status: 'SUCCEEDED',
      startedAt,
      finishedAt: startedAt,
      itemCount: items.length,
      datasetItems: items,
    };
  }

  async getRun(providerRunId: string): Promise<ApifyRunResult> {
    const datasetId = providerRunId.replace('run', 'dataset');
    const items = this.datasets.get(datasetId) ?? [];
    return {
      providerRunId,
      defaultDatasetId: datasetId,
      status: 'SUCCEEDED',
      startedAt: new Date(0).toISOString(),
      finishedAt: new Date(0).toISOString(),
      itemCount: items.length,
      datasetItems: items,
    };
  }

  async listDatasetItems(datasetId: string, opts: { limit: number }): Promise<ApifyDatasetItem[]> {
    const items = this.datasets.get(datasetId) ?? [];
    return items.slice(0, Math.max(0, opts.limit));
  }
}
