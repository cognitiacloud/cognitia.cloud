import { createDb } from './client';
import {
  closerBriefs,
  closerScores,
  complianceLogs,
  outreachDrafts,
  prospectAccounts,
  prospectContacts,
  prospectSignals,
  scrapeRuns,
  vendorSyncEvents,
} from './schema/index';
import { tierForScore } from '@cognitia/config';

/**
 * Demo seed: a curated set of auto dealerships for a boardroom walkthrough.
 *
 * All content is fictional and deterministic. The richer per-account fields
 * live inside existing JSONB columns (no schema change): website-audit funnel
 * gaps in `prospect_signals.value`, call summaries/sentiment in
 * `vendor_sync_events.payload`, and consent provenance in `compliance_logs`.
 */

type FunnelGaps = {
  weakCta: boolean;
  noFinancing: boolean;
  noTradeIn: boolean;
  noAppointmentBooking: boolean;
  noLiveChat: boolean;
  noWhatsApp: boolean;
};

type CallResult = {
  scheduled: boolean;
  outcome:
    | 'booked_meeting'
    | 'callback'
    | 'connected'
    | 'voicemail'
    | 'no_answer'
    | 'not_interested';
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  nextAction: string;
  crmStatus: 'synced' | 'pending';
  durationSec: number;
};

type Dealer = {
  slug: string;
  name: string;
  brand: string;
  city: string;
  state: string;
  founded: number;
  rating: number;
  reviews: number;
  monthlyVisitors: number;
  tools: string[];
  score: number;
  mobilePerf: number;
  pageLoadSec: number;
  gaps: FunnelGaps;
  stage: string;
  nextAction: string;
  contact: { name: string; title: string };
  consent: 'opted_in' | 'opted_out' | 'dnc';
  summary: string;
  pain: string[];
  offer: string[];
  opener: string;
  talk: string[];
  objections: { objection: string; response: string }[];
  emailSubject: string;
  emailBody: string;
  draftPending: boolean;
  call?: CallResult;
};

const GMAPS = 'apify/google-maps-scraper';

const DEALERS: Dealer[] = [
  {
    slug: 'sunrise-toyota',
    name: 'Sunrise Toyota',
    brand: 'Toyota',
    city: 'San Diego',
    state: 'CA',
    founded: 1998,
    rating: 4.2,
    reviews: 1840,
    monthlyVisitors: 52000,
    tools: ['Dealer.com', 'Google Analytics', 'Meta Pixel'],
    score: 88,
    mobilePerf: 38,
    pageLoadSec: 7.4,
    gaps: {
      weakCta: true,
      noFinancing: true,
      noTradeIn: true,
      noAppointmentBooking: true,
      noLiveChat: true,
      noWhatsApp: true,
    },
    stage: 'Brief ready',
    nextAction: 'Approve call draft',
    contact: { name: 'Marcus Bell', title: 'General Manager' },
    consent: 'opted_in',
    summary:
      'High-traffic Toyota rooftop (52k monthly visits) with a weak digital funnel: no online financing, trade-in, or appointment path, and a slow mobile site. Strong fit for a guided-conversion overlay.',
    pain: [
      'Heavy paid + organic traffic leaks out with no captured lead path',
      'No self-serve financing pre-qual — shoppers bounce to aggregators',
      'Mobile site loads in 7.4s; most traffic is mobile',
    ],
    offer: [
      'Guided financing pre-qual + trade-in estimator embedded on existing site',
      '24/7 booking widget that writes appointments straight to the CRM',
      'Mobile speed pass to lift conversion on the highest-traffic pages',
    ],
    opener:
      'Hi Marcus — you’re paying for ~52k visits a month, but the site has no online financing, trade-in, or booking path. Mind if I show you exactly where that traffic is leaking?',
    talk: [
      'Anchor on the 52k monthly visits and the missing financing/trade-in/booking paths',
      'Quantify lost leads: even a 2% capture lift on mobile is hundreds of appointments',
      'Position the guided overlay as additive — no website rebuild required',
    ],
    objections: [
      {
        objection: 'We already have a website vendor.',
        response: 'We sit on top of Dealer.com — no rebuild. We add the conversion paths it lacks.',
      },
      {
        objection: 'Our team is slammed.',
        response: 'Booking writes straight to your CRM, so it saves BDC time rather than adding work.',
      },
    ],
    emailSubject: 'Sunrise Toyota — where ~52k monthly visits are leaking',
    emailBody:
      'Hi Marcus,\n\nI took a look at the Sunrise Toyota site. You’re driving serious traffic (~52k visits/mo), but there’s no online financing pre-qual, no trade-in estimator, and no way to book an appointment — and the mobile site loads in ~7s.\n\nWe add those conversion paths on top of your existing Dealer.com site (no rebuild) and write booked appointments straight into your CRM. Most rooftops see a measurable lift in captured leads within the first month.\n\nWorth a 15-minute look at the specific gaps?\n\n— Cognitia Sales',
    draftPending: true,
    call: {
      scheduled: true,
      outcome: 'booked_meeting',
      summary:
        'Connected with Marcus. Walked through the financing + booking gaps; he confirmed mobile bounce is a known problem. Booked a 30-min demo with the BDC lead for next Tuesday.',
      sentiment: 'positive',
      nextAction: 'Send demo calendar invite + 1-page funnel-gap summary',
      crmStatus: 'synced',
      durationSec: 372,
    },
  },
  {
    slug: 'lakeside-auto-group',
    name: 'Lakeside Auto Group',
    brand: 'Multi-brand',
    city: 'Austin',
    state: 'TX',
    founded: 2005,
    rating: 4.0,
    reviews: 920,
    monthlyVisitors: 31000,
    tools: ['DealerInspire', 'HubSpot', 'Google Ads'],
    score: 81,
    mobilePerf: 44,
    pageLoadSec: 6.1,
    gaps: {
      weakCta: true,
      noFinancing: true,
      noTradeIn: false,
      noAppointmentBooking: true,
      noLiveChat: true,
      noWhatsApp: true,
    },
    stage: 'Approved',
    nextAction: 'Vendor call scheduled',
    contact: { name: 'Priya Nair', title: 'Marketing Director' },
    consent: 'opted_in',
    summary:
      'Multi-brand group running paid search but with no financing pre-qual and no booking path. Already has a trade-in tool, so the wedge is financing + appointments.',
    pain: [
      'Paid search spend with weak landing CTAs',
      'No financing pre-qual to capture in-market buyers',
      'No appointment booking — relies on phone calls',
    ],
    offer: [
      'Financing pre-qual embedded on VDP pages',
      'Appointment booking with CRM write-back',
      'Live chat fallback during showroom hours',
    ],
    opener:
      'Hi Priya — you’re investing in paid search, but the landing pages don’t let a buyer pre-qualify or book. Can I show you the two highest-leverage fixes?',
    talk: [
      'Tie weak CTAs to paid-search waste',
      'Show financing pre-qual as the fastest capture win',
      'Booking write-back saves BDC phone tag',
    ],
    objections: [
      {
        objection: 'We use HubSpot already.',
        response: 'Great — we write leads and appointments straight into HubSpot, no migration.',
      },
    ],
    emailSubject: 'Lakeside — two fixes to stop paid-search leakage',
    emailBody:
      'Hi Priya,\n\nLakeside is clearly investing in paid search, but the landing pages don’t let a shopper pre-qualify for financing or book a visit — so a chunk of that spend leaks.\n\nWe embed financing pre-qual and appointment booking on your VDPs and write everything back into HubSpot. Quick 15-minute walkthrough?\n\n— Cognitia Sales',
    draftPending: false,
    call: {
      scheduled: true,
      outcome: 'callback',
      summary:
        'Reached Priya between meetings. Interested in the financing pre-qual; asked us to call back Thursday after she reviews paid-search numbers with her agency.',
      sentiment: 'positive',
      nextAction: 'Call back Thursday 2pm CT; prep paid-search leakage estimate',
      crmStatus: 'synced',
      durationSec: 188,
    },
  },
  {
    slug: 'desertline-hyundai',
    name: 'DesertLine Hyundai',
    brand: 'Hyundai',
    city: 'Phoenix',
    state: 'AZ',
    founded: 2011,
    rating: 4.4,
    reviews: 1320,
    monthlyVisitors: 28500,
    tools: ['Dealer.com', 'CallRail'],
    score: 76,
    mobilePerf: 51,
    pageLoadSec: 5.2,
    gaps: {
      weakCta: true,
      noFinancing: true,
      noTradeIn: true,
      noAppointmentBooking: false,
      noLiveChat: true,
      noWhatsApp: true,
    },
    stage: 'Researching',
    nextAction: 'Generate closer brief',
    contact: { name: 'Diane Cho', title: 'Internet Sales Manager' },
    consent: 'opted_in',
    summary:
      'Well-reviewed Hyundai store with booking already in place but no financing or trade-in capture. Good intent signals from CallRail volume.',
    pain: ['No financing pre-qual', 'No trade-in estimator', 'Weak primary CTA above the fold'],
    offer: [
      'Financing pre-qual + trade-in estimator',
      'Above-the-fold CTA experiment',
      'WhatsApp click-to-chat for mobile shoppers',
    ],
    opener:
      'Hi Diane — your reviews and call volume are strong, but the site can’t pre-qualify financing or value a trade. Want to see the capture you’re leaving on the table?',
    talk: [
      'Acknowledge strong reputation + call volume',
      'Financing/trade-in as the missing capture layer',
      'WhatsApp for the mobile-heavy Phoenix market',
    ],
    objections: [
      {
        objection: 'We get plenty of calls already.',
        response: 'Exactly — we capture the shoppers who won’t call but will pre-qualify online.',
      },
    ],
    emailSubject: 'DesertLine Hyundai — capture the shoppers who won’t call',
    emailBody:
      'Hi Diane,\n\nDesertLine’s reputation and call volume are strong. The gap is the shoppers who won’t pick up the phone — today the site can’t pre-qualify financing or value a trade for them.\n\nWe add both, plus WhatsApp click-to-chat for your mobile-heavy traffic. Worth a quick look?\n\n— Cognitia Sales',
    draftPending: true,
  },
  {
    slug: 'coastal-ford',
    name: 'Coastal Ford',
    brand: 'Ford',
    city: 'Tampa',
    state: 'FL',
    founded: 1989,
    rating: 3.8,
    reviews: 670,
    monthlyVisitors: 19500,
    tools: ['DealerOn', 'Google Analytics'],
    score: 69,
    mobilePerf: 33,
    pageLoadSec: 8.1,
    gaps: {
      weakCta: true,
      noFinancing: true,
      noTradeIn: true,
      noAppointmentBooking: true,
      noLiveChat: true,
      noWhatsApp: true,
    },
    stage: 'Brief ready',
    nextAction: 'Approve call draft',
    contact: { name: 'Tom Reyes', title: 'Dealer Principal' },
    consent: 'opted_in',
    summary:
      'Legacy Ford store with the slowest mobile site in the set (8.1s) and no online conversion paths. Big upside but lower current digital maturity.',
    pain: ['Very slow mobile site (8.1s)', 'No online funnel at all', 'Declining review score'],
    offer: [
      'Mobile speed remediation',
      'Full guided funnel: financing, trade-in, booking',
      'Reputation recovery playbook',
    ],
    opener:
      'Hi Tom — Coastal’s mobile site takes about 8 seconds to load and has no online financing or booking. That’s a lot of lost ups. Can I show you the numbers?',
    talk: [
      'Lead with mobile speed as the bleeding wound',
      'Bundle the full funnel as the fix',
      'Tie review recovery to faster response',
    ],
    objections: [
      {
        objection: 'We’re an old-school store.',
        response: 'That’s the opportunity — small digital changes compound fast from this baseline.',
      },
    ],
    emailSubject: 'Coastal Ford — ~8s mobile load is costing you ups',
    emailBody:
      'Hi Tom,\n\nCoastal’s mobile site takes around 8 seconds to load, and there’s no online financing, trade-in, or booking. For a store with your traffic, that’s a meaningful number of lost ups every month.\n\nWe can fix the speed and add the conversion paths in weeks, not months. Open to a quick look at the estimate?\n\n— Cognitia Sales',
    draftPending: true,
    call: {
      scheduled: true,
      outcome: 'voicemail',
      summary: 'Left a voicemail referencing the mobile-speed issue and the funnel-gap summary. No callback yet.',
      sentiment: 'neutral',
      nextAction: 'Retry Wednesday AM; send email summary in parallel',
      crmStatus: 'pending',
      durationSec: 42,
    },
  },
  {
    slug: 'metro-honda',
    name: 'Metro Honda',
    brand: 'Honda',
    city: 'Denver',
    state: 'CO',
    founded: 2002,
    rating: 4.5,
    reviews: 2110,
    monthlyVisitors: 47000,
    tools: ['DealerInspire', 'Podium', 'Google Ads'],
    score: 72,
    mobilePerf: 63,
    pageLoadSec: 3.9,
    gaps: {
      weakCta: false,
      noFinancing: true,
      noTradeIn: false,
      noAppointmentBooking: false,
      noLiveChat: false,
      noWhatsApp: true,
    },
    stage: 'Researching',
    nextAction: 'Generate closer brief',
    contact: { name: 'Sara Lindqvist', title: 'eCommerce Director' },
    consent: 'opted_in',
    summary:
      'Digitally mature Honda store — fast site, chat via Podium, booking in place. The single remaining gap is online financing pre-qual.',
    pain: ['No financing pre-qual', 'No WhatsApp channel', 'Paid budget could convert harder'],
    offer: ['Financing pre-qual', 'WhatsApp click-to-chat', 'Conversion analytics layer'],
    opener:
      'Hi Sara — Metro is one of the more digitally mature stores I’ve seen. The one missing piece is online financing pre-qual. Want the quick win?',
    talk: [
      'Respect their maturity',
      'Financing pre-qual as the single highest-ROI add',
      'WhatsApp as a secondary capture channel',
    ],
    objections: [
      {
        objection: 'We’re happy with our stack.',
        response: 'No rip-and-replace — financing pre-qual layers on and reports into your analytics.',
      },
    ],
    emailSubject: 'Metro Honda — the one missing conversion path',
    emailBody:
      'Hi Sara,\n\nMetro Honda is clearly ahead on digital — fast site, chat, booking all in place. The one gap I see is online financing pre-qual, which tends to be the highest-ROI add for a store at your level.\n\nHappy to show the numbers in 15 minutes.\n\n— Cognitia Sales',
    draftPending: false,
  },
  {
    slug: 'velocity-used-cars',
    name: 'Velocity Used Cars',
    brand: 'Independent',
    city: 'Las Vegas',
    state: 'NV',
    founded: 2016,
    rating: 3.6,
    reviews: 410,
    monthlyVisitors: 12800,
    tools: ['Wix', 'Meta Pixel'],
    score: 58,
    mobilePerf: 47,
    pageLoadSec: 5.6,
    gaps: {
      weakCta: true,
      noFinancing: true,
      noTradeIn: true,
      noAppointmentBooking: true,
      noLiveChat: true,
      noWhatsApp: false,
    },
    stage: 'New',
    nextAction: 'Score account',
    contact: { name: 'Eddie Marsh', title: 'Owner' },
    consent: 'opted_out',
    summary:
      'Independent used-car lot on a basic site. Has WhatsApp but nothing else. Contact has unsubscribed from email — email channel is suppressed.',
    pain: ['No financing path', 'Basic Wix site', 'Thin review base'],
    offer: ['Financing pre-qual', 'Trade-in estimator', 'Booking widget'],
    opener:
      'Hi Eddie — you’ve got WhatsApp going, but no financing or booking on the site. Quick idea worth a few minutes?',
    talk: ['Meet them where they are (WhatsApp)', 'Financing as the first add', 'Keep it low-lift'],
    objections: [
      {
        objection: 'We’re small.',
        response: 'That’s why a single capture path can move the needle — low cost, fast setup.',
      },
    ],
    emailSubject: 'Velocity — a quick financing capture idea',
    emailBody:
      'Hi Eddie,\n\nNoticed Velocity uses WhatsApp but doesn’t have online financing or booking yet…',
    draftPending: false,
  },
  {
    slug: 'summit-nissan',
    name: 'Summit Nissan',
    brand: 'Nissan',
    city: 'Salt Lake City',
    state: 'UT',
    founded: 2008,
    rating: 4.1,
    reviews: 980,
    monthlyVisitors: 24000,
    tools: ['Dealer.com', 'CallRail', 'Google Ads'],
    score: 64,
    mobilePerf: 55,
    pageLoadSec: 4.8,
    gaps: {
      weakCta: true,
      noFinancing: true,
      noTradeIn: true,
      noAppointmentBooking: false,
      noLiveChat: true,
      noWhatsApp: true,
    },
    stage: 'New',
    nextAction: 'Score account',
    contact: { name: 'Reuben Ortiz', title: 'Sales Manager' },
    consent: 'dnc',
    summary:
      'Mid-market Nissan store. Contact is on the internal do-not-contact list following a prior request — all outreach is suppressed and shown for governance only.',
    pain: ['No financing or trade-in capture', 'Weak CTA'],
    offer: ['Financing pre-qual', 'Trade-in estimator'],
    opener: '—',
    talk: ['Suppressed — do-not-contact'],
    objections: [],
    emailSubject: 'Suppressed',
    emailBody: 'Contact is on the internal do-not-contact list; no outreach is generated.',
    draftPending: false,
  },
  {
    slug: 'harbor-mazda',
    name: 'Harbor Mazda',
    brand: 'Mazda',
    city: 'Seattle',
    state: 'WA',
    founded: 2013,
    rating: 4.3,
    reviews: 760,
    monthlyVisitors: 21500,
    tools: ['DealerOn', 'Podium'],
    score: 67,
    mobilePerf: 58,
    pageLoadSec: 4.4,
    gaps: {
      weakCta: true,
      noFinancing: true,
      noTradeIn: true,
      noAppointmentBooking: true,
      noLiveChat: false,
      noWhatsApp: true,
    },
    stage: 'Researching',
    nextAction: 'Generate closer brief',
    contact: { name: 'Nina Patel', title: 'BDC Manager' },
    consent: 'opted_in',
    summary:
      'Mazda store with chat in place but no financing, trade-in, or booking. Solid mid-tier fit.',
    pain: ['No financing pre-qual', 'No trade-in', 'No booking widget'],
    offer: ['Financing pre-qual', 'Trade-in estimator', 'Booking widget'],
    opener:
      'Hi Nina — Harbor has chat, but a shopper still can’t pre-qualify, value a trade, or book. Want to see the capture gap?',
    talk: ['Chat is good but mid-funnel', 'Add capture + booking', 'CRM write-back'],
    objections: [
      { objection: 'Chat already covers us.', response: 'Chat starts conversations; capture + booking finish them.' },
    ],
    emailSubject: 'Harbor Mazda — from chat to booked appointments',
    emailBody:
      'Hi Nina,\n\nHarbor’s chat is a good start, but shoppers still can’t pre-qualify, value a trade, or book a visit. We add those and write appointments into your CRM. Quick look?\n\n— Cognitia Sales',
    draftPending: true,
  },
];

/** Populate the database with the dealership demo dataset. */
export async function seed(): Promise<void> {
  const { db, sql } = createDb();
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 86_400_000);

  const [run] = await db
    .insert(scrapeRuns)
    .values({
      source: GMAPS,
      actorRunId: 'mock-run-dealers-001',
      apifyDatasetId: 'mock-dataset-dealers-001',
      input: { query: 'car dealerships', location: 'United States', maxResults: 25 },
      status: 'succeeded',
      requestedBy: 'demo@cognitia.cloud',
      stats: { found: 25, imported: DEALERS.length, deduped: 25 - DEALERS.length },
      startedAt: daysAgo(2),
      finishedAt: new Date(daysAgo(2).getTime() + 90_000),
    })
    .returning();

  for (let i = 0; i < DEALERS.length; i++) {
    const dlr = DEALERS[i]!;
    const domain = `${dlr.slug}.example.com`;
    const sourceUrl = `https://maps.google.com/?cid=demo-${dlr.slug}`;
    const observedAt = daysAgo(2 - (i % 2));

    const [account] = await db
      .insert(prospectAccounts)
      .values({
        domain,
        displayName: dlr.name,
        legalName: `${dlr.name} LLC`,
        industry: `Auto Dealer · ${dlr.brand}`,
        employeeRange: '51-200',
        country: 'US',
        region: dlr.state,
        hqCity: dlr.city,
        linkedinUrl: `https://linkedin.com/company/${dlr.slug}`,
        enrichment: {
          brand: dlr.brand,
          foundedYear: dlr.founded,
          rating: dlr.rating,
          reviewCount: dlr.reviews,
          monthlyVisitors: dlr.monthlyVisitors,
          website: `https://www.${domain}`,
          source: 'Google Maps',
          sourceUrl,
          stage: dlr.stage,
          nextAction: dlr.nextAction,
        },
        dedupeKey: domain,
      })
      .returning();
    if (!account) continue;

    const [contact] = await db
      .insert(prospectContacts)
      .values({
        accountId: account.id,
        fullName: dlr.contact.name,
        title: dlr.contact.title,
        seniority: 'executive',
        email: `${dlr.contact.name.split(' ')[0]!.toLowerCase()}@${domain}`,
        emailStatus: 'verified',
        phone: `+1702555${String(1000 + i).padStart(4, '0')}`,
        linkedinUrl: `https://linkedin.com/in/${dlr.slug}-contact`,
        isPrimary: true,
        consentStatus: dlr.consent,
        dedupeKey: `${dlr.contact.name.split(' ')[0]!.toLowerCase()}@${domain}`,
      })
      .returning();

    // ── Observed evidence (scraped facts) ──────────────────────────────────
    await db.insert(prospectSignals).values([
      {
        accountId: account.id,
        scrapeRunId: run?.id,
        type: 'review',
        value: { rating: dlr.rating, reviewCount: dlr.reviews, source: 'Google', sourceUrl },
        weight: '1.5',
        source: 'google-maps',
        observedAt,
      },
      {
        accountId: account.id,
        scrapeRunId: run?.id,
        type: 'traffic',
        value: { monthlyVisitors: dlr.monthlyVisitors, channel: 'organic+paid', sourceUrl: `https://www.${domain}` },
        weight: '2',
        source: 'similarweb-mock',
        observedAt,
      },
      {
        accountId: account.id,
        scrapeRunId: run?.id,
        type: 'tech_stack',
        value: { tools: dlr.tools, sourceUrl: `https://www.${domain}` },
        weight: '1',
        source: 'builtwith-mock',
        observedAt,
      },
      {
        accountId: account.id,
        type: 'website_audit',
        value: {
          funnelGaps: dlr.gaps,
          mobilePerf: dlr.mobilePerf,
          desktopPerf: Math.min(99, dlr.mobilePerf + 28),
          pageLoadSec: dlr.pageLoadSec,
          mobileFriendly: dlr.mobilePerf >= 50,
          privacyFlags: [],
          screenshotQc: 'Captured & checked by hermes vision-skill (no PII detected)',
          sourceUrl: `https://www.${domain}`,
        },
        weight: '2',
        source: 'hermes-vision',
        observedAt,
      },
    ]);

    // ── Score + breakdown (AI inference) ───────────────────────────────────
    const [score] = await db
      .insert(closerScores)
      .values({
        accountId: account.id,
        model: 'mock-scorer-v1',
        promptVersion: 'score@1',
        score: String(dlr.score),
        tier: tierForScore(dlr.score),
        rationale: dlr.summary,
        breakdown: {
          fit: dlr.score,
          intent: Math.min(98, Math.round(dlr.monthlyVisitors / 600)),
          urgency: 100 - dlr.mobilePerf,
          reachability: dlr.consent === 'opted_in' ? 85 : 30,
        },
        signalsHash: `demo-hash-${dlr.slug}`,
        scoredAt: observedAt,
      })
      .returning();

    // ── Closer brief (AI inference) ────────────────────────────────────────
    const suppressed = dlr.consent === 'dnc';
    const [brief] = suppressed
      ? [undefined]
      : await db
          .insert(closerBriefs)
          .values({
            accountId: account.id,
            scoreId: score?.id,
            summary: dlr.summary,
            painPoints: dlr.pain,
            valueProps: dlr.offer,
            talkTrack: [dlr.opener, ...dlr.talk],
            objections: dlr.objections,
            recommendedChannel: 'voice',
            model: 'mock-brief-v1',
            promptVersion: 'brief@1',
          })
          .returning();

    // ── Outreach draft (human-gated) ───────────────────────────────────────
    if (dlr.draftPending && contact && brief) {
      await db.insert(outreachDrafts).values({
        accountId: account.id,
        contactId: contact.id,
        briefId: brief.id,
        channel: 'email',
        subject: dlr.emailSubject,
        body: dlr.emailBody,
        status: 'pending_approval',
      });
    }

    // ── Compliance provenance (append-only) ────────────────────────────────
    const complianceRows: (typeof complianceLogs.$inferInsert)[] = [
      {
        entityType: 'prospect_account',
        entityId: account.id,
        action: 'data_collected',
        actor: 'system:apify',
        lawfulBasis: 'Legitimate interest (B2B)',
        details: {
          sourceUrl,
          source: 'Google Maps public listing',
          businessRelevance: `${dlr.brand} dealership in ${dlr.city}, ${dlr.state} — ICP match for dealer conversion tooling`,
          collectedAt: observedAt.toISOString(),
        },
        occurredAt: observedAt,
      },
      {
        entityType: 'closer_score',
        entityId: account.id,
        action: 'account_scored',
        actor: 'system:scorer',
        lawfulBasis: 'Legitimate interest (B2B)',
        details: { score: dlr.score, tier: tierForScore(dlr.score), model: 'mock-scorer-v1' },
        occurredAt: observedAt,
      },
    ];
    if (dlr.consent === 'opted_out') {
      complianceRows.push({
        entityType: 'prospect_contact',
        entityId: contact?.id,
        action: 'unsubscribe_applied',
        actor: 'system:compliance',
        lawfulBasis: 'Data subject request',
        details: { channel: 'email', note: 'Contact unsubscribed; email channel suppressed.' },
        occurredAt: daysAgo(1),
      });
    }
    if (dlr.consent === 'dnc') {
      complianceRows.push({
        entityType: 'prospect_contact',
        entityId: contact?.id,
        action: 'dnc_applied',
        actor: 'system:compliance',
        lawfulBasis: 'Data subject request',
        details: { note: 'Contact on internal do-not-contact list; all outreach suppressed.' },
        occurredAt: daysAgo(5),
      });
    }
    if (brief) {
      complianceRows.push({
        entityType: 'closer_brief',
        entityId: account.id,
        action: 'brief_generated',
        actor: 'system:llm',
        lawfulBasis: 'Legitimate interest (B2B)',
        details: { model: 'mock-brief-v1', requiresHumanApproval: true },
        occurredAt: observedAt,
      });
    }
    if (dlr.draftPending) {
      complianceRows.push({
        entityType: 'outreach_draft',
        entityId: account.id,
        action: 'approval_requested',
        actor: 'system',
        lawfulBasis: 'Human-in-the-loop gate',
        details: { note: 'Draft queued for human approval; nothing sends automatically.' },
        occurredAt: observedAt,
      });
    }
    if (dlr.stage === 'Approved' || dlr.call) {
      complianceRows.push({
        entityType: 'outreach_draft',
        entityId: account.id,
        action: 'human_approved',
        actor: 'demo@cognitia.cloud',
        lawfulBasis: 'Human-in-the-loop gate',
        details: { note: 'Approved by sales manager before vendor handoff.' },
        occurredAt: daysAgo(1),
      });
    }
    await db.insert(complianceLogs).values(complianceRows);

    // ── Vendor / call activity ─────────────────────────────────────────────
    if (dlr.call && contact) {
      if (dlr.call.scheduled) {
        await db.insert(vendorSyncEvents).values({
          vendor: 'salescloser',
          eventType: 'call_scheduled',
          accountId: account.id,
          contactId: contact.id,
          externalId: `sc-sched-${dlr.slug}`,
          direction: 'outbound',
          payload: {
            agent: 'SalesCloser.ai (mock)',
            scheduledFor: daysAgo(-1).toISOString(),
            note: 'Scheduled via mock vendor adapter — no real call placed.',
          },
          signatureVerified: true,
          idempotencyKey: `demo-sched-${dlr.slug}`,
          occurredAt: daysAgo(1),
        });
      }
      await db.insert(vendorSyncEvents).values({
        vendor: 'salescloser',
        eventType: 'call_completed',
        accountId: account.id,
        contactId: contact.id,
        externalId: `sc-call-${dlr.slug}`,
        direction: 'inbound',
        payload: {
          agent: 'SalesCloser.ai (mock)',
          summary: dlr.call.summary,
          sentiment: dlr.call.sentiment,
          nextAction: dlr.call.nextAction,
          crmStatus: dlr.call.crmStatus,
          durationSec: dlr.call.durationSec,
          recordingUrl: '#mock-recording',
        },
        signatureVerified: true,
        callOutcome: dlr.call.outcome,
        idempotencyKey: `demo-call-${dlr.slug}`,
        occurredAt: new Date(now - 8 * 3_600_000),
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
