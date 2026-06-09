import { contentFingerprint, type TenantApprovalSettings } from '@cognitia/core';
import type { AgentDeps, SuppressionProvider } from '../deps.js';
import { emptySuppressionProvider } from '../deps.js';
import { AgentRunService } from '../runtime/agentRunService.js';
import { ContextBuilder, nullRetriever, type VectorRetriever } from '../context/contextBuilder.js';
import { ActionLedger } from '../ledger/actionLedger.js';
import { PolicyGate } from '../policies/policyGate.js';
import { runGuardrails, BLOCKING_GUARDRAILS } from '../guardrails/index.js';
import { scoreAccount, type IcpCriteria } from './scoring.js';
import { TemplateMessageGenerator, type MessageGenerator } from './messageGenerator.js';
import { InMemoryDraftStore, type DraftStore } from './draftStore.js';
import { isSuppressed as isSuppressedCheck } from '@cognitia/core';

export interface MiraConfig {
  deps: AgentDeps;
  settings?: TenantApprovalSettings;
  messageGenerator?: MessageGenerator;
  retriever?: VectorRetriever;
  suppression?: SuppressionProvider;
  draftStore?: DraftStore;
  /**
   * Whether Mira may propose `email.draft.send` actions. V1 scope fence: this is
   * FALSE in the production runtime so Mira proposes CRM actions only.
   * Default true preserves the agent package's own email tests.
   */
  emailEnabled?: boolean;
}

export interface MiraRunInput {
  tenantId: string;
  objective: string;
  traceId: string;
  icp?: IcpCriteria;
  playbookRef?: string;
  /** Max candidate accounts to act on this run. */
  maxAccounts?: number;
}

export interface MiraRunResult {
  runId: string;
  proposedActionIds: string[];
  /** Accounts considered, ranked by score (for transparency / debugging). */
  ranked: Array<{ accountId: string; combined: number }>;
  /** Contacts excluded by suppression — proves they were never proposed to. */
  excludedSuppressed: string[];
}

/**
 * Mira v1 orchestrator. Selects + scores accounts, builds grounded context,
 * drafts outreach, runs guardrails, and PROPOSES agent_actions. It never sends:
 * outbound email is always proposed for human approval (see agent-contracts.md).
 */
export class MiraAgent {
  private readonly runService: AgentRunService;
  private readonly contextBuilder: ContextBuilder;
  private readonly ledger: ActionLedger;
  private readonly policyGate: PolicyGate;
  private readonly generator: MessageGenerator;
  private readonly suppression: SuppressionProvider;
  private readonly emailEnabled: boolean;
  readonly draftStore: DraftStore;

  constructor(private readonly config: MiraConfig) {
    this.runService = new AgentRunService(config.deps);
    this.contextBuilder = new ContextBuilder(config.deps.repo, config.retriever ?? nullRetriever);
    this.ledger = new ActionLedger(config.deps);
    this.policyGate = new PolicyGate(config.settings ?? {});
    this.generator = config.messageGenerator ?? new TemplateMessageGenerator();
    this.suppression = config.suppression ?? emptySuppressionProvider;
    this.emailEnabled = config.emailEnabled ?? true;
    this.draftStore = config.draftStore ?? new InMemoryDraftStore();
  }

  async run(input: MiraRunInput): Promise<MiraRunResult> {
    const { deps } = this.config;
    const run = await this.runService.createRun({
      tenantId: input.tenantId,
      agent: 'mira',
      objective: input.objective,
      inputRefs: input.playbookRef ? [input.playbookRef] : [],
      traceId: input.traceId,
    });

    const proposedActionIds: string[] = [];
    const excludedSuppressed: string[] = [];

    try {
      // 1-3. Select + score candidate accounts.
      const accounts = await deps.repo.listAccounts(input.tenantId);
      const ranked = accounts
        .map((a) => ({ account: a, score: scoreAccount(a, input.icp ?? {}) }))
        .sort((x, y) => y.score.combined - x.score.combined);
      const selected = ranked.slice(0, input.maxAccounts ?? 5);

      const suppressionSet = await this.suppression.get(input.tenantId);

      for (const { account } of selected) {
        // 4-5. Pick contacts + build grounded context pack.
        const pack = await this.contextBuilder.build({
          tenantId: input.tenantId,
          accountId: account.id,
          traceId: input.traceId,
          playbookRef: input.playbookRef,
          icp: input.icp as Record<string, unknown> | undefined,
        });

        const contacts = await deps.repo.listContactsByAccount(input.tenantId, account.id);
        // Partition first so every suppressed contact is recorded as excluded,
        // independent of iteration order. Suppressed contacts are never proposed to.
        const eligible = [];
        for (const contact of contacts) {
          const contactRef = `contact:${contact.id}`;
          const suppressed =
            contact.is_suppressed ||
            isSuppressedCheck(
              { email: contact.email_hash ?? undefined, contactRef },
              suppressionSet,
            );
          if (suppressed) {
            excludedSuppressed.push(contactRef);
            continue;
          }
          eligible.push(contact);
        }

        // MVP: act on the first eligible contact per account.
        // V1 scope fence: email proposals are gated off in the production runtime
        // (emailEnabled=false) so Mira proposes CRM actions only.
        for (const contact of this.emailEnabled ? eligible.slice(0, 1) : []) {
          const contactRef = `contact:${contact.id}`;
          // 6-7. Generate grounded draft.
          const candidate = await this.generator.generate({
            contextPack: pack,
            contactRef,
          });

          // 8. Guardrails. Block if a blocking guardrail fails.
          const guardrails = runGuardrails(candidate, { isSuppressed: false, personalized: true });
          const blocked = guardrails.some((g) => BLOCKING_GUARDRAILS.has(g.name) && !g.passed);
          if (blocked) continue;

          // Policy gate (defense in depth alongside suppression exclusion).
          const policy = this.policyGate.evaluate({
            actionType: 'email.draft.send',
            isSuppressed: false,
          });
          if (policy.blocked) continue;

          // 9. Propose an email-draft action. Store body out-of-band.
          const payloadRef = `draft:${deps.newId()}`;
          await this.draftStore.put(payloadRef, {
            subject_line: candidate.subject_line,
            body: candidate.body,
            evidence_refs: candidate.evidence_refs,
          });
          const action = await this.ledger.propose({
            tenantId: input.tenantId,
            agentRunId: run.id,
            agent: 'mira',
            traceId: input.traceId,
            actionType: 'email.draft.send',
            riskLevel: policy.riskLevel,
            targetRef: contactRef,
            evidenceRefs: candidate.evidence_refs,
            contentFingerprint: contentFingerprint(`${candidate.subject_line}\n${candidate.body}`),
            payloadRef,
            guardrailResults: guardrails,
          });
          proposedActionIds.push(action.id);
        }

        // Also propose a low-risk CRM follow-up task for the account.
        const taskPolicy = this.policyGate.evaluate({
          actionType: 'crm.task.create',
          isSuppressed: false,
        });
        const taskAction = await this.ledger.propose({
          tenantId: input.tenantId,
          agentRunId: run.id,
          agent: 'mira',
          traceId: input.traceId,
          actionType: 'crm.task.create',
          riskLevel: taskPolicy.riskLevel,
          targetRef: `account:${account.id}`,
          evidenceRefs: pack.evidence.map((e) => e.id),
          contentFingerprint: contentFingerprint(`follow-up:${account.id}`),
          guardrailResults: [],
        });
        proposedActionIds.push(taskAction.id);
      }

      await this.runService.complete(run, proposedActionIds.length);
      return {
        runId: run.id,
        proposedActionIds,
        ranked: ranked.map((r) => ({ accountId: r.account.id, combined: r.score.combined })),
        excludedSuppressed,
      };
    } catch (err) {
      await this.runService.fail(run, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
