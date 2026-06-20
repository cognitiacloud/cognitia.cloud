import { desc, eq, sql } from 'drizzle-orm';
import {
  closerBriefs,
  closerScores,
  complianceLogs,
  outreachDrafts,
  prospectAccounts,
  prospectContacts,
  prospectSignals,
  vendorSyncEvents,
} from '@cognitia/db';
import { db } from './db';

/** Prospect list with each account's latest score + tier. */
export async function listAccounts() {
  const rows = await db()
    .select({
      id: prospectAccounts.id,
      domain: prospectAccounts.domain,
      displayName: prospectAccounts.displayName,
      industry: prospectAccounts.industry,
      employeeRange: prospectAccounts.employeeRange,
      status: prospectAccounts.status,
    })
    .from(prospectAccounts)
    .orderBy(prospectAccounts.displayName);

  const scores = await db()
    .select({
      accountId: closerScores.accountId,
      score: closerScores.score,
      tier: closerScores.tier,
      scoredAt: closerScores.scoredAt,
    })
    .from(closerScores)
    .orderBy(desc(closerScores.scoredAt));

  const latest = new Map<string, { score: string; tier: string }>();
  for (const s of scores) if (!latest.has(s.accountId)) latest.set(s.accountId, s);

  return rows.map((r) => ({ ...r, latestScore: latest.get(r.id) ?? null }));
}

export async function getAccountDetail(accountId: string) {
  const [account] = await db()
    .select()
    .from(prospectAccounts)
    .where(eq(prospectAccounts.id, accountId))
    .limit(1);
  if (!account) return null;

  const [contacts, signals, scores, briefs, drafts] = await Promise.all([
    db().select().from(prospectContacts).where(eq(prospectContacts.accountId, accountId)),
    db()
      .select()
      .from(prospectSignals)
      .where(eq(prospectSignals.accountId, accountId))
      .orderBy(desc(prospectSignals.observedAt)),
    db()
      .select()
      .from(closerScores)
      .where(eq(closerScores.accountId, accountId))
      .orderBy(desc(closerScores.scoredAt)),
    db()
      .select()
      .from(closerBriefs)
      .where(eq(closerBriefs.accountId, accountId))
      .orderBy(desc(closerBriefs.version)),
    db().select().from(outreachDrafts).where(eq(outreachDrafts.accountId, accountId)),
  ]);

  return { account, contacts, signals, scores, briefs, drafts };
}

export async function getLatestBrief(accountId: string) {
  const [brief] = await db()
    .select()
    .from(closerBriefs)
    .where(eq(closerBriefs.accountId, accountId))
    .orderBy(desc(closerBriefs.version))
    .limit(1);
  return brief ?? null;
}

export async function getWebsiteAuditSignals(accountId: string) {
  return db()
    .select()
    .from(prospectSignals)
    .where(eq(prospectSignals.accountId, accountId));
}

/** Drafts awaiting human approval, joined with contact + account context. */
export async function listPendingDrafts() {
  return db()
    .select({
      draft: outreachDrafts,
      contact: prospectContacts,
      account: prospectAccounts,
    })
    .from(outreachDrafts)
    .innerJoin(prospectContacts, eq(prospectContacts.id, outreachDrafts.contactId))
    .innerJoin(prospectAccounts, eq(prospectAccounts.id, outreachDrafts.accountId))
    .where(eq(outreachDrafts.status, 'pending_approval'))
    .orderBy(desc(outreachDrafts.createdAt));
}

export async function listComplianceLogs(limit = 100) {
  return db()
    .select()
    .from(complianceLogs)
    .orderBy(desc(complianceLogs.occurredAt))
    .limit(limit);
}

/** Aggregate vendor call outcomes for the dashboard. */
export async function dashboardOutcomes() {
  const byOutcome = await db()
    .select({
      outcome: vendorSyncEvents.callOutcome,
      count: sql<number>`count(*)::int`,
    })
    .from(vendorSyncEvents)
    .where(sql`${vendorSyncEvents.callOutcome} is not null`)
    .groupBy(vendorSyncEvents.callOutcome);

  const byEvent = await db()
    .select({
      eventType: vendorSyncEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(vendorSyncEvents)
    .groupBy(vendorSyncEvents.eventType);

  const totalCalls = byOutcome.reduce((a, b) => a + b.count, 0);
  const booked = byOutcome.find((o) => o.outcome === 'booked_meeting')?.count ?? 0;
  const dnc = byOutcome.find((o) => o.outcome === 'dnc')?.count ?? 0;

  return {
    byOutcome,
    byEvent,
    totalCalls,
    booked,
    dnc,
    bookingRate: totalCalls ? Math.round((booked / totalCalls) * 100) : 0,
  };
}
