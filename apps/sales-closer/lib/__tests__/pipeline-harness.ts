/**
 * Test harness for pipeline.test.ts. Owns a disposable Postgres schema and
 * exposes the operations the integration suite drives. Kept separate so the
 * env is configured before this module (and the db singleton) loads.
 */
import { count, eq } from 'drizzle-orm';
import { resetEnvCache } from '@cognitia/config';
import { createDb, runMigrations } from '@cognitia/db';
import {
  complianceLogs,
  outreachDrafts,
  prospectAccounts,
  prospectContacts,
  prospectSignals,
  vendorSyncEvents,
} from '@cognitia/db';
import { scoreAccount, generateBrief } from '@cognitia/core';
import { reviewDraft } from '../services/drafts';
import { createVendorLead, handleVendorWebhook } from '../services/vendor';
import { db } from '../db';

let accountId = '';
let contactId = '';
let draftId = '';

export async function resetSchema(): Promise<void> {
  resetEnvCache();
  const { sql } = createDb();
  await sql.unsafe(
    'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
  );
  await sql.end();
  await runMigrations();
}

export async function seedMinimal(): Promise<void> {
  const [account] = await db()
    .insert(prospectAccounts)
    .values({
      domain: 'harness.example.com',
      displayName: 'Harness Co',
      industry: 'SaaS',
      employeeRange: '51-200',
      dedupeKey: 'harness.example.com',
    })
    .returning();
  accountId = account!.id;

  const [contact] = await db()
    .insert(prospectContacts)
    .values({
      accountId,
      fullName: 'Test Contact',
      title: 'VP Sales',
      email: 'test@harness.example.com',
      phone: '+15125550000',
      isPrimary: true,
      consentStatus: 'opted_in',
      dedupeKey: 'test@harness.example.com',
    })
    .returning();
  contactId = contact!.id;

  await db()
    .insert(prospectSignals)
    .values([
      { accountId, type: 'tech_stack', value: { tools: ['HubSpot'] }, weight: '2' },
      { accountId, type: 'hiring', value: { openSalesRoles: 3 }, weight: '1.5' },
    ]);

  const [draft] = await db()
    .insert(outreachDrafts)
    .values({
      accountId,
      contactId,
      channel: 'voice',
      subject: 'Hello',
      body: 'Hi there',
      status: 'pending_approval',
    })
    .returning();
  draftId = draft!.id;
}

export const scoreFixture = () => scoreAccount(db(), accountId);
export const briefFixture = () => generateBrief(db(), accountId);
export const approveFixtureDraft = () => reviewDraft(draftId, 'approved', 'tester', 'ok');
export const createLeadFromFixtureDraft = () => createVendorLead(draftId, 'tester');

export async function complianceCount(): Promise<number> {
  const [row] = await db().select({ c: count() }).from(complianceLogs);
  return row?.c ?? 0;
}

export async function deliverWebhook(outcome: string, idempotencyKey: string) {
  const rawBody = JSON.stringify({
    eventType: 'call_completed',
    externalId: `call-${idempotencyKey}`,
    outcome,
    idempotencyKey,
  });
  return handleVendorWebhook('mock', { headers: {}, rawBody });
}

export async function deliverDncWebhook() {
  const rawBody = JSON.stringify({
    eventType: 'dnc_requested',
    externalId: 'call-dnc',
    outcome: 'dnc',
    idempotencyKey: 'dnc-1',
    contactId,
  });
  return handleVendorWebhook('mock', { headers: {}, rawBody });
}

export async function eventCountFor(idempotencyKey: string): Promise<number> {
  const rows = await db()
    .select({ id: vendorSyncEvents.id })
    .from(vendorSyncEvents)
    .where(eq(vendorSyncEvents.idempotencyKey, idempotencyKey));
  return rows.length;
}

export async function fixtureContactConsent(): Promise<string> {
  const [row] = await db()
    .select({ s: prospectContacts.consentStatus })
    .from(prospectContacts)
    .where(eq(prospectContacts.id, contactId))
    .limit(1);
  return row?.s ?? 'unknown';
}

export async function close(): Promise<void> {
  // The shared singleton has no explicit teardown; vitest exits the worker.
}
