# Cognitia Crypto Gem Scorecard (LOOP 3)

Self-assessment, 0–5, evidence-tagged. Scores are an **internal `likely_inference`**
(a self-grade, not a third-party rating). 0 = absent, 5 = best-in-class +
externally verifiable. Honesty over flattery.

## Summary

| # | Dimension | Score |
| - | --------- | ----- |
| 1 | Real problem | 5 |
| 2 | Product built | 4 |
| 3 | Runtime proof | 4 |
| 4 | GitHub evidence | 5 |
| 5 | Docs quality | 4 |
| 6 | Public diligence surfaces | 4 |
| 7 | Token necessity | 4 |
| 8 | Token safety | 5 |
| 9 | Legal restraint | 5 |
| 10 | AI-agent relevance | 5 |
| 11 | Market narrative | 4 |
| 12 | Security posture | 3 |
| 13 | Community readiness | 1 |
| 14 | On-chain readiness | 1 |
| 15 | Standards alignment | 3 |
| 16 | Ecosystem integrations | 2 |
| 17 | Moat | 3 |
| 18 | Founder clarity | 4 |
| 19 | Researcher visibility | 3 |
| 20 | Pilot traction | 1 |
| 21 | Revenue/demand evidence | 1 |

**Weighted read**: very strong on the un-fakeable engineering/restraint axes
(1–10), weak on the social/market/external-validation axes (13,14,20,21,16).
That is the *right* shape for an early, serious project — but the weak axes are
exactly what researchers use to decide "real but early" vs "real and proven."

---

## Detail (per dimension)

> Each: score · evidence · missing evidence · fastest improvement · long-term
> improvement · public-safe claim · unsafe claim to avoid · next build.

### 1. Real problem — 5
- Evidence: trust/identity/verifiable-work for agents is a live 2026 theme
  (ERC-8004/x402); `verified_fact` the problem exists.
- Missing: external validation that *Cognitia's* framing resonates with buyers.
- Fastest: publish the narrative (LANE_L) + one design-partner quote (gated).
- Long-term: pilot proof.
- Public-safe: "Agents need verifiable identity, work, and reputation."
- Avoid: market-size promises.
- Next build: SAFE_PUBLIC_NARRATIVE.md.

### 2. Product built — 4
- Evidence: ATC/SkillProof/Proof/Reputation/Credits/Escrow/WorkOrders/Disputes/
  Marketplace implemented + tested (`verified_fact`).
- Missing: outward product polish (detail pages, templates), production deploy.
- Fastest: marketplace detail pages + work-order templates (LOOP 6).
- Long-term: managed deploy (gated).
- Public-safe: "A working internal agent economy, runtime-verified."
- Avoid: "production-ready."
- Next build: marketplace UI depth.

### 3. Runtime proof — 4
- Evidence: live PGlite economy smoke; 490 tests; contract on 2 backends.
- Missing: managed-Postgres RLS under restricted role (U-2); production telemetry.
- Fastest: V-6 RLS run (needs dev DB).
- Long-term: continuous public proof feed (configured).
- Public-safe: "The full economy loop runs live on a real Postgres engine in dev."
- Avoid: "verified in production."
- Next build: V-6.

### 4. GitHub evidence — 5
- Evidence: 490 tests, PR history #48–#63, migrations, CI green (`verified_fact`).
- Missing: outsider repro guide; release tags.
- Fastest: "verify it yourself" README section.
- Long-term: public release notes.
- Public-safe: "Clone and reproduce 490 green tests."
- Avoid: equating tests with production reliability.
- Next build: repro guide.

### 5. Docs quality — 4
- Evidence: architecture lock, token gates, V-4/4b/4c/5 docs, evidence manifest.
- Missing: API/SDK ref, SECURITY.md, public roadmap, governance.
- Fastest: SECURITY.md + API summary (LOOP 4/8).
- Long-term: docs site.
- Public-safe: "Architecture, evidence contract, and gates are documented."
- Avoid: "complete documentation."
- Next build: SECURITY.md.

### 6. Public diligence surfaces — 4
- Evidence: `/trust`, `/trust/live`, PUBLIC_DILIGENCE_OVERVIEW, FAQ.
- Missing: a single researcher-pack entry point; live (configured) feed.
- Fastest: PUBLIC_RESEARCHER_PACK_SPEC + index (LOOP 4).
- Long-term: configure the public feed (gated).
- Public-safe: "A read-only trust/proof explorer exists."
- Avoid: implying the live feed currently shows data (it's empty by default).
- Next build: researcher pack.

### 7. Token necessity — 4
- Evidence: TOKEN_LAB_002 argues collateral-at-risk utility credits can't provide.
- Missing: demonstrated demand for an at-risk-collateral mechanism.
- Fastest: assurance-bond *simulation* (internal, no token).
- Long-term: legal opinion + usage gate.
- Public-safe: "A token would only be assurance collateral, if ever."
- Avoid: "the token will be needed/valuable."
- Next build: bond simulation design.

### 8. Token safety — 5
- Evidence: no token, no sale, no payments; all gates NOT PASSED; doctrine guards.
- Missing: nothing today (this is a strength).
- Fastest: n/a.
- Long-term: keep gated until legal.
- Public-safe: "No public token exists; it is optional and gated."
- Avoid: any launch/price/sale language.
- Next build: keep guards green.

### 9. Legal restraint — 5
- Evidence: internal non-transferable credits; explicit non-investment framing.
- Missing: published compliance-posture page; counsel opinion (D-5).
- Fastest: compliance-posture note (LOOP 4).
- Long-term: counsel engagement.
- Public-safe: "Internal credits, not money, not a token; not an investment."
- Avoid: legal conclusions / "compliant."
- Next build: compliance posture page.

### 10. AI-agent relevance — 5
- Evidence: primitives map 1:1 to agent-economy stack (LANE_B/Q).
- Missing: demonstrated interop.
- Fastest: standards mapping doc (done: LANE_Q).
- Long-term: ERC-8004/EAS/x402 design spikes.
- Public-safe: "Natively aligned with the agent economy."
- Avoid: "compliant/live" with any standard.
- Next build: standards spike specs.

### 11. Market narrative — 4
- Evidence: coherent "proof-backed trust layer" story, repo-backed.
- Missing: single canonical public articulation; distribution.
- Fastest: SAFE_PUBLIC_NARRATIVE.md.
- Long-term: content + design partners.
- Public-safe: the LANE_L one-liner.
- Avoid: "next Ethereum/Solana," hype.
- Next build: narrative doc.

### 12. Security posture — 3
- Evidence: RLS isolation, audit events, deny-by-default, secrets not hardcoded,
  feed hardening (V-5).
- Missing: external audit, pentest, bug-bounty, SECURITY.md, managed-RLS proof.
- Fastest: SECURITY.md + disclosure intake.
- Long-term: external audit (budget-gated).
- Public-safe: "Strong internal controls; external audit pending."
- Avoid: "secure," "audited," "SOC2."
- Next build: SECURITY.md.

### 13. Community readiness — 1
- Evidence: minimal public presence.
- Missing: any public channel, contributors, discussion.
- Fastest: a public README + FAQ that invites scrutiny (not hype).
- Long-term: developer community once stable.
- Public-safe: silence is fine; do not fake community.
- Avoid: bot/engagement farming, fake member counts.
- Next build: none urgent; do not fake.

### 14. On-chain readiness — 1
- Evidence: none (no token/contract by design).
- Missing: n/a today; intentional.
- Fastest: keep as design-only standards mapping.
- Long-term: EAS attestation of proofs (design).
- Public-safe: "No on-chain footprint today."
- Avoid: fabricated on-chain data.
- Next build: EAS attestation design (LOOP 5/6).

### 15. Standards alignment — 3
- Evidence: VC-shaped ATC; reserved external-ref field; LANE_Q mapping.
- Missing: actual spikes; demonstrated mapping.
- Fastest: ERC-8004 mapping doc (design).
- Long-term: spikes (sandbox).
- Public-safe: "compatible-by-design."
- Avoid: "compliant/certified."
- Next build: ERC-8004 + EAS design.

### 16. Ecosystem integrations — 2
- Evidence: HubSpot integration (GTM); internal only otherwise.
- Missing: agent-standard / payment-rail integrations.
- Fastest: x402 sandbox adapter design.
- Long-term: real adapters (gated).
- Public-safe: "Integrations are early."
- Avoid: claiming integrations that don't exist.
- Next build: adapter designs.

### 17. Moat — 3
- Evidence: integration + evidence discipline (only verified_fact moves value).
- Missing: network effects, switching costs, brand.
- Fastest: lean on reproducible-evidence + standards composability.
- Long-term: portable reputation network effect + fabric.
- Public-safe: "Moat = verifiable, proof-backed work others can't fake."
- Avoid: "unbeatable/only solution."
- Next build: fabric thesis (LOOP 5).

### 18. Founder clarity — 4
- Evidence: consistent mission correction (trust/execution/economy/future token).
- Missing: public founder identity (D-4).
- Fastest: team page draft.
- Long-term: public founder voice.
- Public-safe: "Clear mission: proof-backed agent economy."
- Avoid: overclaiming vision as shipped.
- Next build: team page draft.

### 19. Researcher visibility — 3
- Evidence: `/trust`, docs, repo.
- Missing: researcher-pack entry point; discoverability; default branch `main`.
- Fastest: researcher pack + default branch flip (D-7).
- Long-term: published, indexed surfaces.
- Public-safe: "Designed for researcher evaluation."
- Avoid: implying broad visibility that doesn't exist.
- Next build: PUBLIC_RESEARCHER_PACK_SPEC.

### 20. Pilot traction — 1
- Evidence: pilot plans (Tenant Zero, Demandara) but no public proof of a live
  paying tenant.
- Missing: a real, referenceable pilot.
- Fastest: land + (gated) publish one pilot's public-safe proofs.
- Long-term: multiple references.
- Public-safe: "Pilots are in progress."
- Avoid: claiming customers/traction that don't exist.
- Next build: pilot proof (founder-gated).

### 21. Revenue/demand evidence — 1
- Evidence: none public.
- Missing: revenue, LOIs, waitlist.
- Fastest: capture demand signals honestly (gated).
- Long-term: revenue.
- Public-safe: "Pre-revenue; demand validation in progress."
- Avoid: fabricated demand/revenue.
- Next build: none fakeable; founder-led.

## Top 5 fastest score-movers (cheap, safe, high-leverage)
1. Researcher pack + "verify it yourself" repro guide (→ 6,19,4).
2. SECURITY.md + disclosure intake (→ 12,5).
3. SAFE_PUBLIC_NARRATIVE + compliance-posture note (→ 11,9).
4. Default branch → `main` (→ 19) — founder one-click.
5. V-6 managed-RLS verification (→ 3,12) — needs dev DB.
