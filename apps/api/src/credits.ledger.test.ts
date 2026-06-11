import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryRepository, type Repository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * COG-009 — internal credits + wallet placeholders (Command Book §E #10, #13):
 * balanced atomic pairs, idempotent replay, append-only ledger, internal rail
 * only, overdraft policy, placeholder-only wallets, and the legal-gated
 * internal crypto doc.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const OWNER_A = 'c0a00000-0000-0000-0000-00000000000a';
const OWNER_B = 'c0a00000-0000-0000-0000-00000000000b';
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-credits', ...over });

describe('Internal credits + wallet placeholders (COG-009)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let treasuryId: string;
  let agentAcctId: string;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
    const treasury = await handlers.openCreditsAccount(
      asRole('operator', { body: { owner_type: 'system', owner_id: OWNER_A } }),
    );
    treasuryId = (treasury.body as { account: { id: string } }).account.id;
    const agentAcct = await handlers.openCreditsAccount(
      asRole('operator', { body: { owner_type: 'agent', owner_id: OWNER_B } }),
    );
    agentAcctId = (agentAcct.body as { account: { id: string } }).account.id;
  });

  const xfer = (body: Record<string, unknown>) =>
    handlers.transferCredits(asRole('operator', { body }));

  const grant = (key = 'grant-1', amount = 100) =>
    xfer({
      from_account_id: treasuryId,
      to_account_id: agentAcctId,
      amount,
      reason_code: 'grant',
      idempotency_key: key,
    });

  it('a transfer creates one balanced atomic pair; balances derive from the ledger (#10)', async () => {
    const res = await grant();
    const body = res.body as { from_balance: number; to_balance: number; replayed: boolean };
    expect(body.replayed).toBe(false);
    expect(body.from_balance).toBe(-100); // system treasury may go negative
    expect(body.to_balance).toBe(100);

    const entries = await repo.listCreditsLedgerEntries(TENANT);
    expect(entries).toHaveLength(2);
    const debit = entries.find((e) => e.direction === 'debit')!;
    const credit = entries.find((e) => e.direction === 'credit')!;
    expect(debit.amount).toBe(credit.amount);
    expect(debit.idempotency_key).toBe(credit.idempotency_key);
    expect(debit.rail).toBe('internal_credits');

    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.some((a) => a.action === 'credits.transfer_recorded.v1')).toBe(true);
    expect(audits.some((a) => a.action === 'credits.account_created.v1')).toBe(true);
  });

  it('replaying an idempotency key is a no-op (#10)', async () => {
    await grant('same-key');
    const replay = await grant('same-key');
    expect((replay.body as { replayed: boolean }).replayed).toBe(true);
    expect(await repo.listCreditsLedgerEntries(TENANT)).toHaveLength(2); // still one pair
  });

  it('the ledger is append-only: no mutation surface exists anywhere (#10)', () => {
    // Neither the repository nor the handlers expose update/delete for entries.
    const repoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(repo as Repository));
    expect(repoMethods.some((m) => /ledger/i.test(m) && /(update|delete|set|patch)/i.test(m))).toBe(
      false,
    );
    const handlerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(handlers));
    expect(
      handlerMethods.some((m) => /credit|ledger/i.test(m) && /(update|delete|patch)/i.test(m)),
    ).toBe(false);
  });

  it('non-system accounts cannot overdraft; zod rejects non-internal rails and self-transfers', async () => {
    await grant('seed', 50);
    await expect(
      xfer({
        from_account_id: agentAcctId,
        to_account_id: treasuryId,
        amount: 51,
        reason_code: 'refund',
        idempotency_key: 'overdraft-1',
      }),
    ).rejects.toMatchObject({ status: 422 });

    await expect(
      xfer({
        from_account_id: treasuryId,
        to_account_id: agentAcctId,
        amount: 10,
        rail: 'stripe_card',
        reason_code: 'nope',
        idempotency_key: 'rail-1',
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      xfer({
        from_account_id: treasuryId,
        to_account_id: treasuryId,
        amount: 10,
        reason_code: 'self',
        idempotency_key: 'self-1',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('wallet bindings are inert placeholders only (#wallet)', async () => {
    const created = await handlers.createWalletBinding(
      asRole('operator', { body: { owner_type: 'agent', owner_id: OWNER_B } }),
    );
    const binding = created.body as { binding: { chain: string; status: string } };
    expect(binding.binding.chain).toBe('none');
    expect(binding.binding.status).toBe('placeholder');

    // Any attempt at a non-placeholder status is rejected (zod + DB check).
    await expect(
      handlers.createWalletBinding(
        asRole('operator', { body: { owner_type: 'agent', owner_id: OWNER_A, status: 'active' } }),
      ),
    ).rejects.toMatchObject({ status: 400 });

    // No activation route exists.
    const serverSrc = readFileSync(join(here, 'server.ts'), 'utf8');
    const paths = [...serverSrc.matchAll(/app\.\w+\('([^']+)'/g)].map((m) => m[1]!);
    // Word-bounded: 'deactivate' exists (more inert); 'activate' must not.
    expect(paths.some((p) => /wallet/.test(p) && /\b(activate|sign|send)\b/.test(p))).toBe(false);
  });

  it('wallet bindings can be deactivated (placeholder → deactivated; no activation exists)', async () => {
    const created = await handlers.createWalletBinding(
      asRole('operator', { body: { owner_type: 'agent', owner_id: OWNER_B } }),
    );
    const id = (created.body as { binding: { id: string } }).binding.id;

    // No secrets / private keys are stored on the row.
    const stored = (await repo.listWalletBindings(TENANT))[0]!;
    expect(Object.keys(stored).some((k) => /key|secret|seed|mnemonic/i.test(k))).toBe(false);

    const res = await handlers.deactivateWalletBinding(asRole('operator', { params: { id } }));
    expect((res.body as { binding: { status: string } }).binding.status).toBe('deactivated');
    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.some((a) => a.action === 'wallet_binding.deactivated.v1')).toBe(true);
    expect(audits.some((a) => a.action === 'wallet_binding.created.v1')).toBe(true);

    await expect(
      handlers.deactivateWalletBinding(
        asRole('operator', { params: { id: 'c0ffee00-0000-0000-0000-000000000000' } }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('crypto docs are internal and legal-gated only (#13)', () => {
    for (const rel of [
      ['docs', 'cognitia', 'internal', 'CRYPTO_READINESS.md'],
      ['docs', 'cognitia', 'CRYPTO_READINESS_INTERNAL.md'],
    ]) {
      const docPath = join(repoRoot, ...rel);
      expect(existsSync(docPath), rel.join('/')).toBe(true);
      expect(readFileSync(docPath, 'utf8')).toContain('INTERNAL — LEGAL-GATED');
    }
    // The web app has no crypto/token surface (route names + page contents).
    const serverSrc = readFileSync(join(here, 'server.ts'), 'utf8');
    const paths = [...serverSrc.matchAll(/app\.\w+\('([^']+)'/g)].map((m) => m[1]!);
    expect(paths.some((p) => /token|coin|staking|swap|dex/i.test(p))).toBe(false);
  });

  it('the readiness endpoint and page carry the legal-gated language and no marketing (#13–#16)', async () => {
    const res = await handlers.cryptoReadiness(asRole('viewer'));
    const body = res.body as Record<string, unknown> & { statement: string };
    expect(body.statement).toContain('designed-for-later');
    expect(body.statement).toContain('legal review, real usage gates, and founder approval');
    expect(body.token_public_status).toBe('disabled');
    expect(body.real_payment_execution).toBe('disabled');
    expect(body.legal_gate).toBe('not passed');

    // Forbidden marketing language appears neither in the API payload nor the page.
    const forbidden = [
      'launch soon',
      'buy token',
      'get in early',
      'APY',
      'yield',
      'liquidity pool',
      'exchange listing',
      'guaranteed',
      'to the moon',
    ];
    const payload = JSON.stringify(res.body).toLowerCase();
    const page = readFileSync(
      join(repoRoot, 'apps', 'web', 'src', 'app', 'cognitia', 'crypto-readiness', 'page.tsx'),
      'utf8',
    ).toLowerCase();
    for (const phrase of forbidden) {
      expect(payload, `payload: ${phrase}`).not.toContain(phrase.toLowerCase());
      expect(page, `page: ${phrase}`).not.toContain(phrase.toLowerCase());
    }
    expect(page).toContain('legal-gated');
    expect(page).toContain('designed-for-later');
  });

  it('no real payment, token-transfer, or chain-execution route exists (#11, #12)', () => {
    const serverSrc = readFileSync(join(here, 'server.ts'), 'utf8');
    const paths = [...serverSrc.matchAll(/app\.\w+\('([^']+)'/g)].map((m) => m[1]!);
    expect(
      paths.some((p) =>
        /pay|charge|checkout|stripe|stablecoin|usdc|usdt|mint|sign|broadcast/i.test(p),
      ),
    ).toBe(false);
  });

  it('credits routes are RBAC-gated and tenant-scoped', async () => {
    await expect(handlers.transferCredits(asRole('viewer', { body: {} }))).rejects.toMatchObject({
      status: 403,
    });
    const other = await handlers.listCreditsAccounts(
      asRole('viewer', { tenantId: '22222222-2222-2222-2222-222222222222' }),
    );
    expect((other.body as { accounts: unknown[] }).accounts).toHaveLength(0);
  });
});
