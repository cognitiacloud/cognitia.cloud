/**
 * Draft content is stored out-of-band and referenced by `payload_ref` on the
 * agent_action — message bodies are never inlined into events/actions (PII rule).
 * The MVP uses an in-memory store; production would persist to a drafts table.
 */
export interface EmailDraft {
  subject_line: string;
  body: string;
  evidence_refs: string[];
}

export interface DraftStore {
  put(ref: string, draft: EmailDraft): Promise<void>;
  get(ref: string): Promise<EmailDraft | null>;
}

export class InMemoryDraftStore implements DraftStore {
  private readonly drafts = new Map<string, EmailDraft>();
  async put(ref: string, draft: EmailDraft): Promise<void> {
    this.drafts.set(ref, draft);
  }
  async get(ref: string): Promise<EmailDraft | null> {
    return this.drafts.get(ref) ?? null;
  }
}
