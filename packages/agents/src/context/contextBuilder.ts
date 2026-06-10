import { piiHash, type ContextPack, type EvidenceItem } from '@cognitia/core';
import type { Repository, AccountRow, ContactRow } from '@cognitia/db';

/**
 * Canonical evidence derivation from deterministic CRM facts. Single source of
 * truth: the ContextBuilder uses it to ground generation, and WHY-1's decision
 * rationale reuses it so the operator sees EXACTLY the facts the system used —
 * no second, drift-prone implementation.
 */
export function deriveAccountEvidence(account: AccountRow, contacts: ContactRow[]): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  if (account.industry) {
    items.push({
      id: `ev-industry-${account.id}`,
      claim: `${account.name} operates in ${account.industry}`,
      source_ref: `account:${account.id}#industry`,
      score: 0.9,
    });
  }
  if (account.employee_count) {
    items.push({
      id: `ev-size-${account.id}`,
      claim: `${account.name} has roughly ${account.employee_count} employees`,
      source_ref: `account:${account.id}#employee_count`,
      score: 0.8,
    });
  }
  const champion = contacts.find((c) => c.persona && c.title);
  if (champion) {
    items.push({
      id: `ev-contact-${champion.id}`,
      claim: `${champion.title} is a relevant ${champion.persona} persona`,
      source_ref: `contact:${champion.id}#title`,
      snippet_hash: champion.email_hash ?? piiHash(champion.id),
      score: 0.7,
    });
  }
  return items;
}

/**
 * Vector retrieval interface (qualitative context only: playbooks, transcripts,
 * docs). CRM facts always come from SQL — never from the vector store. The MVP
 * default returns nothing; a real retriever is injected later.
 */
export interface VectorRetriever {
  retrieve(input: {
    tenantId: string;
    query: string;
    limit?: number;
  }): Promise<Array<{ chunk_ref: string; score: number }>>;
}

export const nullRetriever: VectorRetriever = {
  async retrieve() {
    return [];
  },
};

export interface BuildContextInput {
  tenantId: string;
  accountId: string;
  traceId: string;
  playbookRef?: string;
  icp?: Record<string, unknown>;
}

/**
 * Builds a ContextPack: deterministic SQL facts first, then vector retrieval.
 * Each structured fact that powers personalization is mirrored as an evidence
 * item so generated claims can cite it (evidence-grounding guardrail).
 */
export class ContextBuilder {
  constructor(
    private readonly repo: Repository,
    private readonly retriever: VectorRetriever = nullRetriever,
  ) {}

  async build(input: BuildContextInput): Promise<ContextPack> {
    const account = await this.repo.getAccount(input.tenantId, input.accountId);
    if (!account) {
      throw new Error(`account ${input.accountId} not found for tenant`);
    }
    const contacts = await this.repo.listContactsByAccount(input.tenantId, input.accountId);

    const evidence = this.buildEvidence(account, contacts);
    const retrieval = await this.retriever.retrieve({
      tenantId: input.tenantId,
      query: `${account.name} ${account.industry ?? ''}`.trim(),
      limit: 5,
    });

    return {
      tenant_id: input.tenantId,
      trace_id: input.traceId,
      account: {
        ref: `account:${account.id}`,
        facts: [this.accountFacts(account)],
      },
      contacts: contacts.map((c) => ({
        ref: `contact:${c.id}`,
        persona: c.persona ?? undefined,
        facts: [this.contactFacts(c)],
      })),
      playbook: input.playbookRef ? { ref: input.playbookRef, icp: input.icp ?? {} } : undefined,
      signals: [],
      evidence,
      retrieval,
    };
  }

  private accountFacts(a: AccountRow): Record<string, unknown> {
    return {
      name: a.name,
      domain: a.domain,
      industry: a.industry,
      employee_count: a.employee_count,
      region: a.region,
    };
  }

  private contactFacts(c: ContactRow): Record<string, unknown> {
    return {
      title: c.title,
      persona: c.persona,
      // PII-safe: reference the hash, not the raw email.
      email_hash: c.email_hash,
    };
  }

  /** Derive citeable evidence from deterministic CRM facts (canonical impl). */
  private buildEvidence(account: AccountRow, contacts: ContactRow[]): EvidenceItem[] {
    return deriveAccountEvidence(account, contacts);
  }
}
