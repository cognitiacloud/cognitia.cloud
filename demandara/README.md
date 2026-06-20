# Demandara — Ads + Media House Engine

Demandara is Cognitia's lightweight media/ads engine for automotive retail. It
turns a dealership into a paid- and organic-social operation that is
**ready to launch** — checklists, a content system, creative concepts, a
tracking plan, and compliance guardrails — without ever spending money,
launching a campaign, or making a promise the dealer can't legally keep.

**Client Zero** is a US mixed-inventory (new + used) dealership. Everything here
is written dealer-agnostic with placeholders (`{{DEALER_NAME}}`, `{{CITY}}`,
`{{STATE}}`, `{{OFFER}}`, `{{URL}}`) so the same engine serves the next dealer.

## The four hard rules

These are non-negotiable and are baked into every artifact in this directory:

1. **No ad spend.** Nothing in this engine authorizes a budget or a payment.
2. **No campaign launch.** Every checklist ends at a human sign-off gate. A
   person — not Demandara — flips the switch.
3. **No credit/financing promises.** No guaranteed approval, no specific
   payment/APR/term promises outside the disclosures the law requires.
4. **No targeting or copy that violates platform policy.** If a platform
   restricts it (credit, discrimination, deceptive pricing), we follow the
   restriction by default.

## Who operates it

- **Operator** — runs the day-to-day: produces content, fills checklists.
- **Reviewer** — dealer-side owner who checks compliance and approves go-live.
  The Reviewer is the only role that can clear a launch gate.
- **Counsel (as needed)** — the dealer's legal/compliance contact reviews
  disclaimer text before first use. Templates here are not legal advice.

## Artifacts

| # | File | What it is |
|---|------|-----------|
| — | [00-engine-overview.md](00-engine-overview.md) | How the engine works: workflow, roles, launch gate |
| 1 | [01-google-ads-readiness.md](01-google-ads-readiness.md) | Google Ads readiness checklist |
| 2 | [02-meta-ads-readiness.md](02-meta-ads-readiness.md) | Meta (Facebook/Instagram) Ads readiness checklist |
| 3 | [03-tiktok-readiness.md](03-tiktok-readiness.md) | TikTok readiness checklist |
| 4 | [04-content-calendar.md](04-content-calendar.md) | Dealership content calendar |
| 5 | [05-reel-ideas.md](05-reel-ideas.md) | 20 short-form vehicle reel ideas |
| 6 | [06-ad-campaign-concepts.md](06-ad-campaign-concepts.md) | 10 ad campaign concepts (concepts only) |
| 7 | [07-landing-page-tracking-plan.md](07-landing-page-tracking-plan.md) | Landing page tracking plan |
| 8 | [08-compliance-disclaimers.md](08-compliance-disclaimers.md) | US compliance disclaimer library |
| 9 | [09-what-not-to-claim.md](09-what-not-to-claim.md) | Prohibited / high-risk ad language |

## Safety constraints

- **Plan-only by default.** This engine produces readiness artifacts and
  creative concepts. It does not create live ad accounts, install pixels on a
  live domain, upload audiences, or start campaigns.
- **No spend, ever, from this engine.** Budgets are set by a human in the ad
  platform after the launch gate is cleared.
- **Compliance is default-on.** Where US law (FTC, Truth in Lending / Reg Z) or
  a platform policy restricts a claim or a targeting option, the restriction
  wins. See [08](08-compliance-disclaimers.md) and [09](09-what-not-to-claim.md).
- **No credit/financing promises.** Financing is the highest-risk area in auto
  advertising. Treat every financing statement as requiring counsel review and
  the disclosures in [08](08-compliance-disclaimers.md).
- **Human owns the launch.** Demandara never flips a campaign live; the Reviewer
  does, after signing the launch gate in [00](00-engine-overview.md).

> Policy detail in these docs reflects platform rules as of mid-2026. Platform
> policies change frequently — **verify against the live policy pages before any
> launch.** Source links are listed at the bottom of each platform checklist.
