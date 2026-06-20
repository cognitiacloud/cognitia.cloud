# Discovery Questionnaire — Auto Growth OS

Purpose: capture everything needed to scope the engagement, recommend a package,
and set a measurable baseline — in 15–20 minutes. Every question carries a
**field tag** (`like_this`) that feeds the Discovery Console and the proof plan,
so answers flow straight into a recommendation and later into reporting.

How to use: send as a self-serve form before the call, or walk through it live
using `02-meeting-script.md`. Required fields for a recommendation are marked ★.

> Guardrails: this form **collects** finance and trade-in preferences; it never
> states a rate, payment, approval, or trade-in value. See
> `../internal/guardrails.md`.

---

## Section A — Business profile

1. ★ Dealership name, location(s), and website URL (if any).
2. ★ What do you sell? `dealership_type` — one of:
   `new` / `used` / `both` / `specialty` (e.g. luxury, EV, commercial, bikes).
3. How long in business, and how many rooftops/locations?
4. Who are your top 2–3 local competitors?
5. What makes buyers choose you over them? (Used for brand voice + AEO answers.)

## Section B — Inventory

6. ★ How many vehicles in stock on an average day? `inventory_size` — one of:
   `under_50` / `50_200` / `200_500` / `500_plus`.
7. ★ How is inventory updated today? `inventory_update_method` — one of:
   `manual_entry` / `spreadsheet` / `dms_feed` / `phone_photos`.
8. Average days-on-lot before a vehicle sells? (Baseline metric.)
9. Who takes the vehicle photos today, and on what? (Phone, DSLR, none.)
10. Do listings currently go anywhere beyond your lot? (Website, Marketplace,
    social, classifieds — list them.)

## Section C — Current website & tech

11. ★ Current website state? `current_website` — one of:
    `none` / `basic` / `outdated` / `modern`.
12. Who controls the domain and hosting? (Needed for launch logistics.)
13. What can the current site NOT do that you wish it could?
14. ★ Current CRM / lead tracking? `current_crm` — one of:
    `none` / `spreadsheet` / `dealer_crm` / `generic_crm`.
15. What tools are you already paying for that must stay? (We design around them.)

## Section D — Lead channels

16. ★ Where do leads come from today? `lead_channels[]` — select all:
    `walk_in` / `phone` / `whatsapp` / `telegram` / `facebook_marketplace` /
    `instagram` / `web_form` / `referral` / `paid_ads`.
17. Which channel produces your **best** customers? (Used for attribution focus.)
18. ★ Roughly how many inbound inquiries per week, across all channels?
    (Baseline metric — estimate is fine.)
19. How fast does someone typically respond to a new inquiry today?
    (Minutes / hours / next day — baseline for response-time KPI.)

## Section E — Sales team & process

20. ★ How many people sell cars? `sales_team_size` — one of:
    `solo` / `team_2_5` / `team_6_15` / `team_15_plus`.
21. Walk me through what happens from "lead comes in" to "deal closed".
22. Where do leads most often go cold? (The leak we instrument first.)
23. Do you follow up with people who didn't buy? How?
24. What hours is someone available to respond? (Sets after-hours AI scope.)

## Section F — Goals & KPIs

25. ★ Single most important goal for the next 90 days? `primary_goal` — one of:
    `more_leads` / `faster_response` / `higher_close_rate` /
    `online_presence` / `inventory_online`.
26. If this engagement worked, what would be visibly different in 90 days?
27. What does a "good month" look like in your numbers today? (Baseline.)
28. Any seasonality we should plan around?

## Section G — Budget & commitment

29. ★ Monthly budget comfort band? `monthly_ad_budget` — one of:
    `under_1k` / `1k_3k` / `3k_7k` / `7k_plus`.
    (This sizes scope and ad-management add-ons, not a financing figure.)
30. Who signs off on spend and go-live?
31. How soon do you want to start?

## Section H — Brand & markets

32. ★ Markets / languages you serve? `markets_languages[]` — select all:
    `english` / `spanish` / `bilingual_en_es` / `other` (specify).
33. Brand tone: how should you sound to a buyer? (e.g. trusted local / premium /
    no-pressure / high-energy.)
34. Logos, brand colors, photography we should use? (Assets for the site build.)

## Section I — Compliance (finance & trade-in)

> These set **handling rules**, not customer-facing claims. Everything here is
> drafted and held under `[REQUIRES HUMAN APPROVAL]`.

35. ★ How should financing be handled? `finance_handling` — one of:
    `none` (we don't show financing) /
    `collect_only` (capture interest, human follows up) /
    `dealer_approved_copy` (dealer supplies pre-approved language only).
36. ★ How should trade-ins be handled? `tradein_handling` — one of:
    `none` /
    `collect_only` (capture vehicle details, human values it) /
    `dealer_approved_ranges` (dealer supplies approved ranges only).
37. Who is the named human approver for finance/trade-in content?
38. Any legal/disclaimer language your market requires on listings or ads?

---

## Output of this questionnaire

A completed form produces the **config object** the Discovery Console consumes:

```json
{
  "dealership_type": "used",
  "inventory_size": "50_200",
  "inventory_update_method": "spreadsheet",
  "current_website": "outdated",
  "current_crm": "spreadsheet",
  "lead_channels": ["walk_in", "phone", "whatsapp", "facebook_marketplace"],
  "sales_team_size": "team_2_5",
  "primary_goal": "faster_response",
  "monthly_ad_budget": "1k_3k",
  "markets_languages": ["bilingual_en_es"],
  "finance_handling": "collect_only",
  "tradein_handling": "collect_only"
}
```

Paste/transfer this into `console/discovery-console.html` (or fill the screens
directly) to generate the recommended package, modules, and roadmap emphasis.
The same fields become the baseline in `proposal/12-proof-reporting-plan.md`.
