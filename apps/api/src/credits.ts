import { randomUUID } from 'node:crypto';
import type {
  Repository,
  CreditsAccountRow,
  CreditsLedgerEntryRow,
  WalletBindingRow,
} from '@cognitia/db';
import { creditsTransfer, walletBindingCreate } from '@cognitia/core';
import { z } from 'zod';

/**
 * Internal Credits + Wallet Placeholders (COG-009, Lane C). Doctrine
 * (Architecture Lock §5 — re-read before touching this file):
 *   - INTERNAL credits only: an accounting ledger, not a currency. No real
 *     payments, no Stripe, no stablecoin, no token, no pricing language.
 *   - The ledger is append-only double-entry: a transfer is one balanced
 *     debit+credit pair sharing an idempotency key, inserted atomically.
 *     Balances are SUMs over entries, never stored-and-mutated.
 *   - Only `system`-owned accounts may go negative (they are the internal
 *     grant source); agent/tenant accounts need sufficient balance.
 *   - Wallet bindings are inert placeholders (status check-locked): no
 *     signing, no custody, no transactions, no chain activation in v1.1.
 */

const accountOpenBody = z.object({
  owner_type: z.enum(['tenant', 'agent', 'system']),
  owner_id: z.string().uuid(),
});

export interface AccountView extends CreditsAccountRow {
  /** Derived: Σ credits − Σ debits over the append-only ledger. */
  balance: number;
}

function balanceOf(accountId: string, entries: CreditsLedgerEntryRow[]): number {
  return entries.reduce((total, e) => {
    if (e.account_id !== accountId) return total;
    return total + (e.direction === 'credit' ? Number(e.amount) : -Number(e.amount));
  }, 0);
}

/** Open (or return) the account for an owner. Idempotent. */
export async function openAccount(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
): Promise<CreditsAccountRow> {
  const input = accountOpenBody.parse(body ?? {});
  const ts = new Date().toISOString();
  const account = await repo.upsertCreditsAccount({
    id: randomUUID(),
    tenant_id: tenantId,
    owner_type: input.owner_type,
    owner_id: input.owner_id,
    status: 'active',
    created_at: ts,
    updated_at: ts,
  });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'credits.account_created.v1',
    subject_ref: `credits_account:${account.id}`,
    detail: { owner_type: input.owner_type },
    occurred_at: ts,
    created_at: ts,
  });
  return account;
}

export async function getAccountView(
  repo: Repository,
  tenantId: string,
  accountId: string,
): Promise<AccountView> {
  const account = await repo.getCreditsAccount(tenantId, accountId);
  if (!account) throw new CreditsAccountNotFoundError(accountId);
  const entries = await repo.listCreditsLedgerEntries(tenantId, accountId);
  return { ...account, balance: balanceOf(accountId, entries) };
}

export interface TransferResult {
  idempotency_key: string;
  amount: number;
  /** True when this call found the pair already ledgered and changed nothing. */
  replayed: boolean;
  from_balance: number;
  to_balance: number;
}

/**
 * Transfer credits: one balanced debit+credit pair, atomic, idempotent.
 * Retries with the same idempotency_key are no-ops that return the original
 * outcome — the ledger is never mutated, only appended.
 */
export async function transfer(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
): Promise<TransferResult> {
  const input = creditsTransfer.parse({
    ...(body as Record<string, unknown>),
    tenant_id: tenantId,
  });
  // v1.1: the internal rail is the ONLY enabled rail. The zod enum reserves
  // future rail names conceptually, but nothing else may be written (the
  // 0012 check constraint backs this up at the DB).
  if (input.rail !== 'internal_credits') {
    throw new RailNotEnabledError(input.rail);
  }

  const [from, to] = await Promise.all([
    repo.getCreditsAccount(tenantId, input.from_account_id),
    repo.getCreditsAccount(tenantId, input.to_account_id),
  ]);
  if (!from) throw new CreditsAccountNotFoundError(input.from_account_id);
  if (!to) throw new CreditsAccountNotFoundError(input.to_account_id);
  if (from.status !== 'active' || to.status !== 'active') {
    throw new AccountNotActiveError();
  }

  // Idempotent replay: the pair already exists → no-op.
  const existing = await repo.findCreditsLedgerByIdempotencyKey(tenantId, input.idempotency_key);
  if (existing.length > 0) {
    const all = await repo.listCreditsLedgerEntries(tenantId);
    return {
      idempotency_key: input.idempotency_key,
      amount: Number(existing[0]!.amount),
      replayed: true,
      from_balance: balanceOf(from.id, all),
      to_balance: balanceOf(to.id, all),
    };
  }

  // Overdraft rule: only system accounts (the internal grant source) may go
  // negative; everyone else needs sufficient balance.
  const allBefore = await repo.listCreditsLedgerEntries(tenantId);
  if (from.owner_type !== 'system' && balanceOf(from.id, allBefore) < input.amount) {
    throw new InsufficientCreditsError(from.id);
  }

  const ts = new Date().toISOString();
  const base = {
    tenant_id: tenantId,
    amount: input.amount,
    rail: input.rail,
    reason_code: input.reason_code,
    idempotency_key: input.idempotency_key,
    created_at: ts,
  };
  await repo.insertCreditsLedgerPair(
    {
      ...base,
      id: randomUUID(),
      account_id: from.id,
      counter_account_id: to.id,
      direction: 'debit',
    },
    {
      ...base,
      id: randomUUID(),
      account_id: to.id,
      counter_account_id: from.id,
      direction: 'credit',
    },
  );
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'credits.transfer_recorded.v1',
    subject_ref: `credits_account:${from.id}`,
    detail: { to: to.id, amount: input.amount, reason_code: input.reason_code },
    occurred_at: ts,
    created_at: ts,
  });

  const allAfter = await repo.listCreditsLedgerEntries(tenantId);
  return {
    idempotency_key: input.idempotency_key,
    amount: input.amount,
    replayed: false,
    from_balance: balanceOf(from.id, allAfter),
    to_balance: balanceOf(to.id, allAfter),
  };
}

/** Create an inert wallet-binding placeholder (Lane C, legal-gated). */
export async function createWalletBinding(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
): Promise<WalletBindingRow> {
  const input = walletBindingCreate.parse({
    ...(body as Record<string, unknown>),
    tenant_id: tenantId,
  });
  const ts = new Date().toISOString();
  const binding = await repo.insertWalletBinding({
    id: randomUUID(),
    tenant_id: tenantId,
    owner_type: input.owner_type,
    owner_id: input.owner_id,
    chain: input.chain,
    address: input.address ?? null,
    status: 'placeholder',
    created_at: ts,
    updated_at: ts,
  });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'wallet_binding.created.v1',
    subject_ref: `wallet_binding:${binding.id}`,
    detail: { chain: binding.chain },
    occurred_at: ts,
    created_at: ts,
  });
  return binding;
}

/**
 * Deactivate a wallet placeholder (0014 widens the status check to allow
 * 'deactivated' — strictly MORE inert; activation still does not exist).
 */
export async function deactivateWalletBinding(
  repo: Repository,
  tenantId: string,
  bindingId: string,
  actorRef: string,
): Promise<WalletBindingRow> {
  const updated = await repo.deactivateWalletBinding(tenantId, bindingId);
  if (!updated) throw new WalletBindingNotFoundError(bindingId);
  const ts = new Date().toISOString();
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'wallet_binding.deactivated.v1',
    subject_ref: `wallet_binding:${bindingId}`,
    detail: {},
    occurred_at: ts,
    created_at: ts,
  });
  return updated;
}

export class CreditsAccountNotFoundError extends Error {
  constructor(id: string) {
    super(`credits account not found: ${id}`);
    this.name = 'CreditsAccountNotFoundError';
  }
}
export class AccountNotActiveError extends Error {
  constructor() {
    super('both accounts must be active to transfer');
    this.name = 'AccountNotActiveError';
  }
}
export class InsufficientCreditsError extends Error {
  constructor(accountId: string) {
    super(`insufficient credits in account ${accountId} (only system accounts may go negative)`);
    this.name = 'InsufficientCreditsError';
  }
}
export class RailNotEnabledError extends Error {
  constructor(rail: string) {
    super(`rail '${rail}' is not enabled in v1.1 — internal_credits is the only live rail`);
    this.name = 'RailNotEnabledError';
  }
}
export class WalletBindingNotFoundError extends Error {
  constructor(id: string) {
    super(`wallet binding not found: ${id}`);
    this.name = 'WalletBindingNotFoundError';
  }
}
