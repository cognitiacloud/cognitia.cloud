/** A raw item as returned by an Apify dataset (intentionally loose). */
export interface ApifyDatasetItem {
  companyName?: string;
  website?: string;
  domain?: string;
  industry?: string;
  size?: string;
  city?: string;
  country?: string;
  linkedinUrl?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLinkedin?: string;
  [key: string]: unknown;
}

export interface StartActorResult {
  runId: string;
  datasetId: string;
  status: 'queued' | 'running' | 'succeeded';
}

export interface ApifyClient {
  startActor(actorId: string, input: Record<string, unknown>): Promise<StartActorResult>;
  fetchDataset(datasetId: string): Promise<ApifyDatasetItem[]>;
}
