# Competitor Map — Cognitia GTM Research (Worker A)

> Loop: 36h agentic loop, start 2026-06-20. Classification per GUARDRAILS.md:
> **VERIFIED** (cited primary/secondary source), **INFERRED** (reasoned from partial
> evidence), **RECOMMENDED** (judgment call for founder). No PII; no outreach.

Cognitia spans three adjacent markets. No single competitor covers all three, which
is the core wedge. This map covers each lane, then the cross-lane synthesis.

---

## Lane A — Agent-economy / AI agent trust, proof & verification infrastructure

This is the fastest-moving, most strategically loaded lane. In 2025–2026 the
"verify the agent" category went from concept to funded protocols and shipping
standards. Cognitia's "proof registry / action ledger / agent trust infrastructure"
lives here.

### Prove — Verified Agent
- **What:** Trust/verification layer for agentic commerce; cryptographically binds
  verified identity, intent, payment credentials and consent for an agent acting on
  a user's behalf. **VERIFIED** ([Prove blog, Oct 2025](https://www.prove.com/blog/prove-verified-agent-secure-agentic-commerce)).
- **Positioning:** "Secure the $1.7T agentic commerce revolution." Identity-first,
  enterprise/financial-services flavored. **VERIFIED** (same source).
- **Pricing:** Not public. **INFERRED**: enterprise/contact-sales motion.
- **Strength:** Established identity/fraud brand, telco-grade identity signals.
- **Gap Cognitia can exploit:** Prove proves *identity at the moment of payment*. It
  does not give a domain operator (e.g. a dealership) an *action ledger / proof of
  what the agent did and whether it was compliant over time*. **INFERRED.**

### Trulioo — Digital Agent Passport (DAP) + Know Your Agent (KYA)
- **What:** Identity/trust framework for AI agents; "Digital Agent Passport" =
  lightweight tamper-resistant identity token, introduced with PayOS. **VERIFIED**
  ([Biometric Update / search corpus](https://www.biometricupdate.com/202604/ai-agents-are-already-inside-your-digital-infrastructure)).
- **Funding/scale:** Reported $475M raised at ~$1.75B valuation. **VERIFIED (secondary)**
  — single-source, treat as directional. **INFERRED** it is a heavyweight, not nimble.
- **Gap:** Identity issuance ≠ outcome proof + compliance control plane. KYA answers
  "is this a real authorized agent"; Cognitia can own "did this agent do the right
  thing, and here is the receipt." **RECOMMENDED** wedge framing.

### HUMAN Security — HUMAN Verified AI Agent (open source)
- **What:** Open-source foundation for trustworthy agent identity; positioning as
  "secure infrastructure for how AI agents interact with the internet." **VERIFIED**
  ([HUMAN Security blog](https://www.humansecurity.com/learn/blog/human-verified-ai-agent-open-source/)).
- **Strength:** Open-source distribution + bot-defense pedigree.
- **Gap:** Bot/abuse-defense lineage, not a business proof-of-work/compliance ledger
  for revenue-generating agents. **INFERRED.**

### Skyfire — KYAPay / Know Your Agent
- **What:** Protocol that verifies to consumer *and* merchant that an agent acts for a
  real authorized user; demoed end-to-end autonomous purchase with Visa Intelligent
  Commerce. **VERIFIED** ([Morningstar/BusinessWire, Dec 2025](https://www.morningstar.com/news/business-wire/20251218520399/skyfire-demonstrates-secure-agentic-commerce-purchase-using-the-kyapay-protocol-and-visa-intelligent-commerce)).
- **Gap:** Payment-rail centric. Same opening: transactional verification, not a
  durable per-business action ledger / CRM-adjacent proof layer. **INFERRED.**

### Standards & rails (not competitors — substrate Cognitia should ride)
- **Google AP2** (Agent Payments Protocol, Sept 2025, 60+ partners incl. Mastercard,
  Amex, PayPal, Coinbase, Salesforce): Intent Mandate + Cart Mandate as verifiable
  credentials. **VERIFIED** ([Crossmint explainer](https://www.crossmint.com/learn/agentic-payments-standard)).
- **Coinbase x402** (May 2025): stablecoin-native HTTP payment standard. **VERIFIED** (same).
- **Visa Trusted Agent Protocol (TAP)** (Oct 2025): merchants distinguish trusted
  agents from bots via verifiable signatures. **VERIFIED** (same corpus).
- **ERC-8004** (Ethereum mainnet, 2026-01-29; backed by MetaMask, Ethereum Foundation,
  Google contributors): on-chain verifiable identity + **reputation scoring** for
  autonomous agents. **VERIFIED** ([Biometric Update corpus](https://www.biometricupdate.com/202605/foundation-pushes-beyond-bitcoin-into-identity-ai-authorization-with-6-4m-raise)).
  > This is the single most relevant primitive to Cognitia's "proof registry."
- **A2A `agent-card.json`** — first AI-agent entry in IANA `.well-known` registry
  (April 2025, Linux Foundation). **VERIFIED** ([search corpus](https://zylos.ai/research/2026-03-07-ai-agent-identity-discovery-trust-frameworks)).
- **Visa/Mastercard intent to make agentic payment standards mandatory** for agent
  transactions (risk attribution + chargebacks). **VERIFIED (secondary)**.

### Governance / observability adjacency
- **Straiker, Galileo, Zenity, Prediction Guard** — agent governance/observability:
  tamper-resistant timestamped ledgers of agent actions, audit trails mapped to
  EU AI Act / NIST AI RMF / ISO 42001 / PCI-DSS. **VERIFIED**
  ([Galileo](https://galileo.ai/blog/ai-agent-compliance-governance-audit-trails-risk-management),
  [Straiker](https://www.straiker.ai/solution/ai-compliance-governance)).
- **Gap:** These are *enterprise security/DevOps* tools (sold to CISO/platform teams).
  None is packaged as a *revenue-side, SMB-friendly "proof your agent earned this
  outcome" ledger* tied to a vertical (autos). **INFERRED** — this is Cognitia's lane seam.

**Lane A takeaway (RECOMMENDED):** The market is crowded on *identity/payment
verification at the transaction moment* and on *enterprise governance for the CISO*.
It is thin on **durable, business-facing proof-of-outcome ledgers** that a non-technical
operator can read and trust — especially tied to a vertical and to revenue events.

---

## Lane B — Automotive dealership growth / marketing OS (CRM, BDC, lead gen)

Cognitia's Client Zero (dealership / Auto Growth OS) competes here. This lane is
real-revenue, entrenched, and increasingly "AI-agent" branded.

### DriveCentric
- **What:** Modern automotive CRM with AI-powered automation hub acting as a 24/7
  virtual BDC agent; DMS + inventory integration. **VERIFIED**
  ([AutoRaptor ranking](https://www.autoraptor.com/blog/the-top-30-ai-compatible-automotive-crms-for-dealerships-in-2025-ranked-reviewed/),
  [DriveCentric](https://drivecentric.com/products/ai-agents)).
- **Strength:** UX/mobile, incumbent CRM trust, AI agents bolted onto system of record.
- **Pricing:** Not public; **INFERRED** enterprise per-rooftop.
- **Gap:** It IS the CRM — so it's a system of record, not a neutral proof layer.
  No cross-vendor action ledger / proof a dealer can trust independent of the CRM. **INFERRED.**

### Podium (AI Employee "Jerry" for auto)
- **What:** All-in-one conversational AI (sell, schedule, communicate 24/7); books test
  drives, manages service calls; "trusted by 6,000+ dealerships." **VERIFIED**
  ([Podium auto](https://www.podium.com/product/ai-employee/auto), [automotive.podium.com](https://automotive.podium.com/)).
- **Pricing:** ~$400–$1,200/mo. **VERIFIED (secondary)** (search corpus / AutoRaptor).
- **Strength:** Huge install base, messaging + reviews + payments bundle, patent-pending
  10+ yrs conversation data.
- **Gap:** Engagement/communication layer; outcome attribution is self-reported by
  Podium itself (no neutral proof). **INFERRED.**

### Numa
- **What:** "First AI agent platform for auto dealerships" (NADA 2025); Appointment
  Agent books service appointments with **full AI transparency on calls**; launched
  Voice-AI Smart Inbox (Nov 2025). 1,200+ dealerships. **VERIFIED**
  ([Digital Dealer](https://digitaldealer.com/news/nada-2025-numa-unveils-first-ai-agent-platform-for-auto-dealerships/163365/),
  [PRNewswire](https://www.prnewswire.com/news-releases/numa-introduces-the-first-voice-ai-with-a-smart-inbox-that-understands-every-customer-conversation-for-dealerships-302623160.html)).
- **Pricing:** **Pay-for-performance — dealers only pay for appointments fully booked by
  AI.** **VERIFIED** (PRNewswire/Numa). ← Most important competitive datapoint in this lane.
- **Strength:** Outcome-priced + "full transparency" — Numa is *already* selling
  proof-of-outcome as the wedge. They are the closest competitor to Cognitia's thesis
  inside autos, but scoped to *service appointments*, not sales/F&I/whole-funnel.
- **Gap Cognitia can exploit:** Numa proves *booked appointments in service*. Cognitia
  can extend proof-of-outcome across the *whole sales funnel + F&I + cross-vendor
  attribution* and make the proof portable/auditable rather than Numa-internal. **RECOMMENDED.**

### Impel
- **What:** AI customer-lifecycle management; "sell smarter, book showroom appointments
  faster, close like a machine." ~450 employees, $126M+ funding. **VERIFIED (secondary)**
  ([Impel](https://impel.ai/), search corpus).
- **Gap:** Broad lifecycle suite; outcome proof again self-reported. **INFERRED.**

### Legacy CRMs / DMS-adjacent: VinSolutions, DealerSocket, Elead, AutoRaptor
- **What:** Entrenched automotive CRMs; AutoRaptor publishes transparent pricing
  $500–$1,500/mo, unlimited users. **VERIFIED** (AutoRaptor).
- **Strength:** System-of-record lock-in, OEM relationships.
- **Gap:** Slow on agentic/proof; legacy UX; **INFERRED** ripe for a neutral proof/
  attribution layer that sits *above* them rather than replacing them.

**Lane B takeaway:** Numa already validated outcome-based pricing + "AI transparency"
in autos — proof that dealers will buy this framing. The seam: everyone is a *point
solution + self-reported outcomes*. No neutral, cross-vendor, auditable action ledger
the dealer principal can trust. **RECOMMENDED** Cognitia angle: "the proof layer over
your AI stack," not yet-another-bot.

---

## Lane C — AI SDR / sales-closer / GTM automation (horizontal)

Cognitia's "Sales Closer / CRM-lite / GTM" capability competes here. This lane just
went through a credibility crisis that is itself the wedge.

### 11x.ai ("Alice"/"Mike" digital workers)
- **What:** Autonomous AI SDR / "digital workers" for outbound. **VERIFIED**
  ([11x](https://www.11x.ai/blog/top-ai-sales-automation-tools-to-watch-in-2025)).
- **Pricing:** ~$60K/yr; enterprise can exceed $50K/yr. **VERIFIED (secondary)**.
- **THE PUBLIC CONTROVERSY / ALLEGATIONS (load-bearing for Cognitia):** TechCrunch
  (Mar 2025) *reported* allegations of ARR inflation via a 90-day "break clause" counted
  as full ACV; claimed ~$10M ARR vs ~$3M retained; marquee logos (ZoomInfo, Airtable)
  described as short pilots used without consent; ZoomInfo reportedly said 11x performed
  worse than its own SDRs and churned; churn estimated 75–90% at 3 months; founder stepped
  down as CEO May 2025. These are *reported allegations* (some disputed by 11x), not
  adjudicated findings. **VERIFIED** that they were publicly reported — directly cited:
  ([Inc.](https://www.inc.com/shama-hyder/ais-theranos-moment-what-the-11x-scandal-reveals-about-credibility/91174653),
  [Salesmotion](https://salesmotion.io/blog/turns-out-ai-sdrs-are-too-good-to-be-true-11x-might-face-legal-action),
  [AiSDR/TechCrunch recap](https://aisdr.com/blog/11x-techcrunch/)).
- **Gap Cognitia can exploit:** The entire category now has a **trust deficit on
  outcomes**. "Prove the agent actually did the work and produced the result" is exactly
  Cognitia's proof-registry/action-ledger pitch. This is the strongest narrative wedge
  in the whole map. **RECOMMENDED.**

### Artisan ("Ava")
- **What:** AI sales automation focused on email + LinkedIn workflows. **VERIFIED**
  ([11x guide](https://www.11x.ai/guides/artisan-vs-11x)).
- **Pricing:** ~$2,000–$5,000/mo, custom quotes, not public. **VERIFIED (secondary)**.
- **Gap:** Same outcome-trust deficit; channel-narrow. **INFERRED.**

### Qualified ("Piper" / PiperX) — inbound AI SDR
- **What:** Inbound AI SDR / website conversion; PiperX = multimodal (text/voice/video)
  + multi-agent. **VERIFIED** ([search corpus](https://marketbetter.ai/blog/qualified-review-2026/)).
- **Pricing:** ~$40K–$68K/yr list, enterprise $90K+; **hard Salesforce dependency**
  adding $30K–$60K/yr. **VERIFIED (secondary)** ([Knock-AI](https://www.knock-ai.com/blog/qualified-pricing),
  [Qualified pricing](https://www.qualified.com/pricing)).
- **Strength:** Best-in-class inbound if you're on Salesforce w/ enterprise budget.
- **Gap:** Salesforce lock-in, enterprise price floor; useless to an SMB dealership.
  **INFERRED.**

### Broader market reality check
- "Fully autonomous AI SDRs have not replaced human teams at any meaningful scale;
  by early 2026 most deployers reverted to hybrid/human-first." **VERIFIED (secondary)**
  ([Amplemarket](https://www.amplemarket.com/blog/best-ai-sales-agents)).
- Scheduling tools (e.g. Chili Piper) ~ $22.50/user/mo anchor the low end. **VERIFIED (secondary)**.

**Lane C takeaway:** The category sold "autonomy"; the market punished it for
unverifiable outcomes and inflated claims. The opening is **verifiable, human-in-the-loop
outcomes with a ledger** — sell *proof and accountability*, not *autonomy*. **RECOMMENDED.**

---

## Cross-lane synthesis — where Cognitia wins

| Capability | Lane A (trust infra) | Lane B (auto OS) | Lane C (AI SDR) | **Cognitia** |
|---|---|---|---|---|
| Agent identity/verification | ✅ strong (Prove, Trulioo, Skyfire) | ❌ | ❌ | ✅ (ride standards) |
| Outcome/action ledger | ⚠️ enterprise-only (Galileo/Straiker) | ⚠️ self-reported | ❌ (trust crisis) | **✅ wedge** |
| Outcome-based pricing | ❌ | ⚠️ Numa (service only) | ❌ | **✅ extend** |
| Vertical proof (autos) | ❌ | ✅ but siloed | ❌ | **✅ Client Zero** |
| Neutral / cross-vendor | ❌ | ❌ (each is system of record) | ❌ | **✅ wedge** |
| SMB-affordable | ❌ | ✅ ($400–1.5K/mo) | ❌ (>$40K/yr) | **✅ target** |

**The seam (INFERRED + RECOMMENDED):** No competitor offers a *neutral, cross-vendor,
auditable proof-of-outcome ledger* that is (a) affordable to an SMB operator,
(b) tied to a real vertical (autos), and (c) riding the emerging agent-identity
standards (ERC-8004 / AP2 / TAP) rather than reinventing them. Lane A proves *identity*,
Lane B/C self-report *outcomes*; Cognitia proves *outcomes* and makes them portable.

**Biggest competitive threat (INFERRED):** Numa. It already ships outcome-based pricing
+ "AI transparency" in autos with 1,200+ rooftops. If Numa broadens from service
appointments to full-funnel proof, it occupies Cognitia's intended position from inside
the vertical. Watch closely.
