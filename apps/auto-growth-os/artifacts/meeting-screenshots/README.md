# Cognitia Auto Growth OS — Meeting Screenshot Pack

Boardroom-ready captures of the live demo (light executive theme). Captured at a 1920×1080
viewport, 2× device scale (3840×2160 PNGs) for crisp projection; `mobile-view` at 414×896.

> All data is mocked and local. Integrations (WhatsApp, CRM/DMS, Google/Meta Ads, AI, email/SMS)
> are simulated. Ad spend is paid directly by the client in their own ad accounts.

## Screenshots → slides

| File                           | Shows                                                                                 | Suggested slide                   |
| ------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------- |
| `cover-home.png`               | Front door: value prop + live product-preview command center                          | Title / "What is Auto Growth OS"  |
| `system-map.png`               | Traffic→Capture→Qualify→Nurture→Book→Close→Retain over the shared customer data layer | "How it works" / architecture     |
| `dashboard-command-center.png` | KPIs, SLA alerts, lead table with source attribution, score breakdown + next action   | "Operate it" / the command center |
| `intake-recommendation.png`    | 12-question intake → Empire proposal (pricing, modules, timeline, rationale)          | "Scoping & pricing"               |
| `customer-mapper.png`          | Customer memory: profile, consent, and full relationship timeline                     | "Retention / customer memory"     |
| `pricing-menu.png`             | Pilot / Growth / Empire tiers + à-la-carte modules                                    | "Packages & pricing"              |
| `ai-agents-human-approval.png` | AI drafts a reply — gated behind explicit human approval (Approve & send / Discard)   | "Trust: human-approved AI"        |
| `mobile-view.png`              | Responsive mobile quality of the storefront                                           | "Mobile-first" (appendix)         |

## 5-minute meeting walkthrough

1. **Open `/meeting`** (the guided demo landing) — or start at **`/`**. One line: "Website, intake,
   CRM, and AI agents for dealership growth." Point at the live product-preview.
2. **`/dashboard`** — the command center. KPIs, SLA alerts, the lead table with source attribution.
   Open a lead → "Why this score." Click **Draft AI reply** → show the **human-approval gate**.
3. **`/intake`** — "This is how we scope a dealer." Hit **Generate my recommendation** → the
   **Empire** proposal (setup/monthly ranges, modules, timeline, rationale). Lower the budget to
   show it drop to Growth/Pilot — the engine is explainable.
4. **`/customer-mapper`** — open **Mr. X**: his Civic, his son's birthday, the coffee preference,
   the next best action, and the full relationship timeline through the repurchase window.
5. **`/system-map`** — close on one pipeline over one shared customer record; finish on the
   **Trust & Compliance** band.

## Run it locally

```bash
# from the monorepo root
pnpm install
pnpm --filter @cognitia/auto-growth-os dev      # http://localhost:3002
# production build:
pnpm --filter @cognitia/auto-growth-os build
pnpm --filter @cognitia/auto-growth-os start
```

Open first in the meeting: **`/meeting`** (guided demo) — or `/` for the front door.

## How these were captured

A transient Playwright script drove the production build (`next start`) with
`prefers-reduced-motion` enabled (so on-scroll reveals are fully visible). Playwright and Chromium
are **not** project dependencies — the system Chromium at `/opt/pw-browsers/chromium` was used via a
throwaway `playwright-core` install. Nothing was added to `package.json` or the lockfile.

## Caveats (mocked demo)

- Leads, customers, vehicles, modules, and packages are mock JSON in `src/data/`.
- "Send WhatsApp", "Draft AI reply", and "Log to CRM" are simulated and return
  `{ simulated: true }`; no message is sent anywhere.
- KPI deltas/sparklines on the dashboard are illustrative.
- The live lead flow persists in the browser's `localStorage`; "Reset demo data" restores the seed.
