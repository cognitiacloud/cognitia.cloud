import { createDb } from './client';
import {
  closerBriefs,
  closerScores,
  outreachDrafts,
  prospectAccounts,
  prospectContacts,
  prospectSignals,
  scrapeRuns,
  vendorSyncEvents,
  type NewProspectAccount,
} from './schema/index';
import { tierForScore } from '@cognitia/config';

const INDUSTRIES = ['SaaS', 'E-commerce', 'Fintech', 'Healthtech', 'Logistics'];
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000'];

function makeAccount(i: number): NewProspectAccount {
  const domain = `prospect${i}.example.com`;
  return {
    domain,
    displayName: `Prospect ${i} Inc`,
    legalName: `Prospect ${i} Incorporated`,
    industry: INDUSTRIES[i % INDUSTRIES.length],
    employeeRange: SIZES[i % SIZES.length],
    country: 'US',
    region: 'CA',
    hqCity: 'San Francisco',
    linkedinUrl: `https://linkedin.com/company/prospect-${i}`,
    enrichment: { foundedYear: 2010 + (i % 12) },
    dedupeKey: domain,
  };
}

/** Populate the database with deterministic mock data for local dev + e2e. */
export async function seed(): Promise<void> {
  const { db, sql } = createDb();

  const [run] = await db
    .insert(scrapeRuns)
    .values({
      source: 'apify/google-maps-scraper',
      actorRunId: 'mock-run-001',
      apifyDatasetId: 'mock-dataset-001',
      input: { query: 'B2B SaaS companies San Francisco' },
      status: 'succeeded',
      requestedBy: 'seed',
      stats: { accounts: 15, contacts: 15 },
      startedAt: new Date(Date.now() - 3600_000),
      finishedAt: new Date(Date.now() - 3500_000),
    })
    .returning();

  const outcomes = [
    'booked_meeting',
    'no_answer',
    'voicemail',
    'not_interested',
    'callback',
    'connected',
  ] as const;

  for (let i = 1; i <= 15; i++) {
    const [account] = await db.insert(prospectAccounts).values(makeAccount(i)).returning();
    if (!account) continue;

    const [contact] = await db
      .insert(prospectContacts)
      .values({
        accountId: account.id,
        fullName: `Alex Founder ${i}`,
        title: 'VP Sales',
        seniority: 'executive',
        email: `alex${i}@prospect${i}.example.com`,
        emailStatus: 'verified',
        phone: `+1415555${String(1000 + i).padStart(4, '0')}`,
        isPrimary: true,
        consentStatus: 'opted_in',
        dedupeKey: `alex${i}@prospect${i}.example.com`,
      })
      .returning();

    await db.insert(prospectSignals).values([
      {
        accountId: account.id,
        scrapeRunId: run?.id,
        type: 'tech_stack',
        value: { tools: ['HubSpot', 'Segment'] },
        weight: '2',
        source: 'builtwith',
      },
      {
        accountId: account.id,
        scrapeRunId: run?.id,
        type: 'hiring',
        value: { openSalesRoles: i % 5 },
        weight: '1.5',
        source: 'linkedin',
      },
      {
        accountId: account.id,
        type: 'website_audit',
        value: { hasLiveChat: i % 2 === 0, privacyFlags: [], lighthousePerf: 60 + (i % 40) },
        weight: '1',
        source: 'hermes-vision',
      },
    ]);

    const rawScore = 30 + ((i * 7) % 65);
    const [score] = await db
      .insert(closerScores)
      .values({
        accountId: account.id,
        model: 'mock-scorer-v1',
        promptVersion: 'score@1',
        score: String(rawScore),
        tier: tierForScore(rawScore),
        rationale: `Fit driven by tech stack and ${i % 5} open sales roles.`,
        breakdown: { fit: rawScore, intent: (rawScore + 10) % 100, reachability: 70 },
        signalsHash: `seed-hash-${i}`,
      })
      .returning();

    const [brief] = await db
      .insert(closerBriefs)
      .values({
        accountId: account.id,
        scoreId: score?.id,
        summary: `Prospect ${i} Inc is scaling its sales org and likely feels pipeline pressure.`,
        painPoints: ['Manual prospecting', 'Slow follow-up', 'Low connect rates'],
        valueProps: ['Automated qualified pipeline', 'Human-approved outreach'],
        talkTrack: [`Open with their ${i % 5} open sales roles`, 'Quantify rep ramp cost'],
        objections: [{ objection: 'We already use a tool', response: 'We sit upstream of it.' }],
        recommendedChannel: 'voice',
        model: 'mock-brief-v1',
        promptVersion: 'brief@1',
      })
      .returning();

    // First five accounts get a draft pending approval.
    if (i <= 5 && contact && brief) {
      await db.insert(outreachDrafts).values({
        accountId: account.id,
        contactId: contact.id,
        briefId: brief.id,
        channel: 'voice',
        subject: `Quick idea for Prospect ${i}`,
        body: `Hi Alex, noticed Prospect ${i} is hiring sales reps…`,
        status: 'pending_approval',
      });
    }

    // Accounts 6+ have vendor activity for the dashboard.
    if (i > 5 && contact) {
      const outcome = outcomes[i % outcomes.length]!;
      await db.insert(vendorSyncEvents).values({
        vendor: 'mock',
        eventType: 'call_completed',
        accountId: account.id,
        contactId: contact.id,
        externalId: `mock-call-${i}`,
        direction: 'inbound',
        payload: { durationSec: 60 + i },
        signatureVerified: true,
        callOutcome: outcome,
        idempotencyKey: `seed-call-${i}`,
      });
    }
  }

  await sql.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => {
      console.log('Seed complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
