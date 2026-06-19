# Cognitia Auto Growth OS (`@cognitia/auto-growth-os`)

A polished, **client-meeting demo** of a dealership growth operating system: a fast dealership
website, client intake, lead capture & routing, a CRM-style command center, a pricing/module
recommendation engine, a customer-memory view, and mocked WhatsApp / Google / Meta / AI agent
workflows.

This app lives in the Cognitia monorepo as a pnpm workspace package alongside `@cognitia/web`,
`@cognitia/api`, and `@cognitia/worker`.

> **This is a demo.** It runs entirely locally with **no external services**. Every integration
> (WhatsApp, CRM/DMS, Google/Meta Ads, AI, email/SMS) ships as a simulated adapter stub backed by
> mock JSON. Nothing is sent anywhere.

Brand: **Cognitia** — dark navy enterprise theme, gold accents, cyan/mint technology accents.

---

## Tech

- **Next.js 15** (App Router) + **React 19**, **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS v4** (CSS-first `@theme` tokens), self-hosted fonts via `next/font` (Inter + Sora)
- Tests via the monorepo's root **Vitest**
- No paid APIs, no heavy UI libraries, lightweight CSS animations only

---

## Run it (from the monorepo root)

```bash
# install the whole workspace once
pnpm install

# dev server for just this app (http://localhost:3002)
pnpm --filter @cognitia/auto-growth-os dev

# production build / start
pnpm --filter @cognitia/auto-growth-os build
pnpm --filter @cognitia/auto-growth-os start

# typecheck just this app
pnpm --filter @cognitia/auto-growth-os typecheck

# run the lead-scoring unit tests (root vitest picks up src/**/*.test.ts)
pnpm test
```

The repo-wide gate is `pnpm check` (format:check + typecheck + test), the same checks CI runs.

---

## File structure

```
apps/auto-growth-os/
  package.json · tsconfig.json · next.config.mjs · postcss.config.mjs · next-env.d.ts · .env.example
  src/
    app/                 / landing, /intake, /dashboard, /customer-mapper, /modules, /system-map
                         api/intake + api/leads (thin demo facades), layout.tsx, globals.css
    components/          brand/ ui/ landing/ intake/ dashboard/ customer/ modules/ system/
    lib/                 scoring.ts (+ test), recommendation.ts, metrics.ts, constants.ts, format.ts
                         store/ (Context + localStorage live state), adapters/ (simulated integrations)
    data/                vehicles(6), leads(8), customers(3), modules(8), packages(3)  — mock JSON
    types/index.ts       single source of truth for the domain model
```

**Import convention (so both the app typecheck and the monorepo root `.ts` sweep pass):** pure
node-safe logic lives in `.ts` files using **relative imports**; anything that imports React or
touches the DOM is a `.tsx` file and may use the `@/*` → `src/*` alias.

---

## What's complete / mocked / needs real access

**Complete:** all six pages (responsive, mobile-first); pure unit-tested lead scoring; the
Pilot/Growth/Empire recommendation engine; the live lead flow (landing form → scored → appears in
`/dashboard`, persisted in `localStorage`, with a "Reset demo data" control); dashboard KPIs, lead
table, and detail panel; intake → recommendation; Customer Mapper profiles + timelines; module &
package pricing; system map.

**Mocked:** WhatsApp / CRM-DMS / Google-Meta Ads / AI / email-SMS adapters return
`{ simulated: true, detail }` and log to the console; all data is mock JSON in `src/data/`.

**Needs real client access after approval:** WhatsApp Cloud API, a CRM/DMS, Google/Meta Ads
accounts (read-only reporting — ad spend stays in the client's own accounts), an AI provider key
(drafts only; the human-approval gate stays), email/SMS providers, and a datastore to replace the
in-browser demo store.

---

## How real integrations would be added

Every integration sits behind a typed interface in `src/lib/adapters/types.ts` with a `Mock*`
implementation wired up in `src/lib/adapters/index.ts`. Going live means implementing a real
adapter against the same interface and swapping the one line in the registry — no call-site changes.

| Integration   | Interface             | Demo stub                 | Production adapter (example)               |
| ------------- | --------------------- | ------------------------- | ------------------------------------------ |
| WhatsApp      | `WhatsAppAdapter`     | `MockWhatsAppAdapter`     | WhatsApp Cloud API (`/messages`)           |
| CRM / DMS     | `CrmAdapter`          | `MockCrmAdapter`          | HubSpot / VinSolutions / DealerSocket      |
| Ads reporting | `AdsReportingAdapter` | `MockAdsReportingAdapter` | Google Ads API + Meta Marketing API (read) |
| AI agent      | `AiAgentAdapter`      | `MockAiAgentAdapter`      | LLM service — drafts only, human-approved  |
| Email / SMS   | `MessagingAdapter`    | `MockMessagingAdapter`    | Resend/SendGrid (email), Twilio (SMS)      |

Credentials for each are templated in `.env.example`. The AI adapter's `draftReply()` returns
`requiresHumanApproval: true` as a literal type, so no code path can auto-send — the human approval
gate is structural, not just policy.

---

## Demo script (5-minute walkthrough)

1. **Landing (`/`)** — fast, mobile-first storefront; scroll the inventory and the
   Website + Intake + CRM + AI strip; note the live "dealership pulse" panel.
2. **Capture a lead** — fill the lead form, tick test drive / financing / trade-in, pick a vehicle,
   watch the live score climb, submit, then click "See it in the dashboard."
3. **Dashboard (`/dashboard`)** — the new lead is on top (green dot). Walk the KPIs, filter by
   stage, open the detail panel, show "Why this score," click "Draft AI reply" (human-approval
   gate) and "Send WhatsApp" (simulated). Mention "Reset demo data."
4. **Intake → recommendation (`/intake`)** — pre-filled; "Generate my recommendation" lands on
   Empire; show ranges, modules, pass-through costs, timeline, rationale; lower the budget to drop
   to Growth/Pilot.
5. **Customer Mapper + System Map** — open "Mr. X" (Civic, son's birthday, coffee, next best
   action, full timeline); finish on the system map and the Trust & Compliance band.

---

## Compliance

Visible throughout (`ComplianceNotice`): CASL-ready consent tracking, one-click unsubscribe,
internal do-not-call suppression, human approval gates for AI, no autonomous discount/finance/legal/
warranty promises, and data minimization + access control.

## Deployment

As part of the monorepo, deploy on Vercel by setting the project **Root Directory** to
`apps/auto-growth-os` (framework auto-detects Next.js). Or self-host:
`pnpm --filter @cognitia/auto-growth-os build` then `… start` (serves on `$PORT`, default 3002).
