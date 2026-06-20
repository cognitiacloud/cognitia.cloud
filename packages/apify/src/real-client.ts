import { env } from '@cognitia/config';
import type { ApifyClient, ApifyDatasetItem, StartActorResult } from './types';

/** Thin wrapper over the Apify REST API. */
export class RealApifyClient implements ApifyClient {
  constructor(private readonly token = env.APIFY_TOKEN) {}

  private requireToken(): string {
    if (!this.token) throw new Error('APIFY_TOKEN is required when MOCK_MODE is off');
    return this.token;
  }

  async startActor(actorId: string, input: Record<string, unknown>): Promise<StartActorResult> {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${this.requireToken()}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error(`Apify start error ${res.status}: ${await res.text()}`);
    const { data } = (await res.json()) as {
      data: { id: string; defaultDatasetId: string; status: string };
    };
    return {
      runId: data.id,
      datasetId: data.defaultDatasetId,
      status: data.status === 'SUCCEEDED' ? 'succeeded' : 'running',
    };
  }

  async fetchDataset(datasetId: string): Promise<ApifyDatasetItem[]> {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&token=${this.requireToken()}`,
    );
    if (!res.ok) throw new Error(`Apify dataset error ${res.status}: ${await res.text()}`);
    return (await res.json()) as ApifyDatasetItem[];
  }
}
