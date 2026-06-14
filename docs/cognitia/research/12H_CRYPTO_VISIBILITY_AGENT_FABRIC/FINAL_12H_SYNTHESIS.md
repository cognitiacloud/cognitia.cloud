# Cognitia 12-Hour Crypto Visibility + Agent Fabric Research Sprint — Final Synthesis

## Executive summary

Cognitia's credible path to being taken seriously by crypto researchers is to
amplify what almost no AI-crypto project has — reproducible, proof-backed
engineering (490 tests on two DB backends, append-only evidence, runtime smoke)
and disciplined restraint (no token, loud gates, an explicit "what we do not
claim" page) — and to make that evidence **publicly legible** to a skeptical
researcher. In parallel, the founder's "CMUX-like but distributed" idea is best
framed as a **resilient agent fabric**: verifiable agent work routed across
user-owned and cloud compute, bound to Cognitia's existing economy primitives.
The fabric is designed here, **not built**; its remote-execution surface is a P0
security concern that must stay gated behind a containment-model sign-off.

This sprint produced: an honest video-failure record + reconciliation path; 18
deep-search lanes; a 21-dimension self-scorecard; 5 public-safe visibility docs;
12 distributed-fabric design docs; a future roadmap; a 10-archetype founder
council; doc formatting fixes. No production code, schema, migration, or deploy.

## Baseline state

- Main `16c83f5` (#63 V-5 hardening already merged at sprint start). `pnpm check`
  490/490, 74 files, green. Trust feed deny-by-default + empty (`COGNITIA_PUBLIC_
TENANT_ID` unset). Doctrine guards green (no token/coin routes; no marketing literals).

## Video transcript result

UNAVAILABLE. Egress is blocked (curl/WebFetch 403); no yt-dlp / youtube-transcript-
api; WebSearch can't resolve the opaque id. No content fabricated. Created an
honest failure report + a reconciliation placeholder + an independent (clearly
non-attributed) research framework for the founder to reconcile against later.

## Deep search findings (18 lanes)

Strongest signals: the agent-economy tailwind is real and standards-backed
(ERC-8004 reported mainnet Jan 2026; x402 reported 100M+ payments); serious
diligence rewards reproducible engineering + restraint and punishes token-first
hype; the dominant failure mode is fake-AI / token-first / yield-bait / anonymous-
team rugs. Cognitia is natively aligned and is the inverse of the failure pattern.

## What serious crypto researchers look for

Named credible team · working reproducible product · active GitHub/tests/PRs ·
real docs (incl. security + risk) · credible/necessary tokenomics (or none) ·
demand/traction · external audit · legal restraint · standards alignment ·
honest self-disclosure of gaps. Cognitia is strong on product/GitHub/docs/legal/
restraint; weak on team identity, external audit, managed-RLS proof, and traction.

## Cognitia gem scorecard (self-assessed; see COGNITIA_GEM_SCORECARD.md)

High (4–5): real problem, product, runtime proof, GitHub, docs, token safety,
legal restraint, AI-agent relevance, narrative, founder clarity. Low (1–2):
community, on-chain, ecosystem integrations, pilot traction, revenue. The shape is
"real but early."

## Visibility gaps

No single researcher entry point; no explicit "verify it yourself"; scattered
narrative; no public SECURITY page; default branch not `main`; team anonymous;
live feed empty. All closable; most are cheap and need no founder gate.

## Public-safe diligence improvements (delivered as specs/docs)

Researcher pack spec; canonical safe narrative; unsafe-language blacklist;
diligence-surface roadmap; visibility gap analysis. Plus a pointer added to the
existing CRYPTO_VISIBILITY_001 roadmap.

## Distributed agent fabric thesis

"Verifiable agent work across compute you control." Composition of a private mesh
(Tailscale/WireGuard) + capability registry (SkillProof-backed) + a proof/policy/
reputation-aware router + signed execution receipts (Proof Registry) + the existing
economy (escrow/disputes/reputation). Novelty = proof-backed economics on
distributed execution, not the networking.

## CMUX / Tailscale research

cmux (Manaflow AI) = native macOS terminal for parallel AI coding agents in
isolated sandboxes; single-machine, no proof/economy layer. Cognitia generalizes
the isolation+orchestration idea to cross-platform nodes over a private mesh, adds
verifiable receipts + economics. Tailscale/WireGuard = transport only; Cognitia =
trust + economy.

## Agent economy integration

Fabric maps 1:1 onto existing primitives (ATC/SkillProof/Proof/Reputation/Work
Orders/Credits/Escrow/Marketplace/Disputes/Action Ledger). Invariants preserved:
only verified_fact moves value/reputation; no uncontrolled agent execution; verify/
dispute stay human; credits non-transferable.

## Token / settlement implications

Settles in internal credits today. Distribution _may_ later motivate a token, but
only as assurance collateral (bond/slash) across trust boundaries — same as
TOKEN_LAB_002. All gates remain NOT PASSED; may never launch. Future spikes
(assurance-bond simulation w/ credits, x402 sandbox adapter, EAS attestation) are
design-only, sandbox-only, gated; no mainnet.

## Security and compliance warnings

The fabric's remote-execution is P0: zero-trust, least privilege, sandboxing,
approval-gated sensitive actions, signed attestations, audit, per-node kill switch.
No remote shell push; no secrets/keys in agents. Compliance: keep credits-only;
legal opinion before any token or real cross-tenant settlement (FINTRAC/FinCEN,
securities). External audit + managed-RLS verification are the top assurance gaps.

## Claims we must not make

No token launch/sale/presale/price/return/APY/yield/"get in early"/"next
Ethereum"; no "production-ready/SOC2/audited/secure"; no "decentralized &
impossible to shut down/uncensorable/evades government"; no fabricated on-chain/
community/traction data. (See UNSAFE_LANGUAGE_BLACKLIST.md.)

## Feature roadmap (see FUTURE_READY_ROADMAP_12H.md)

Immediate-safe → near-term product → fabric (gated) → protocol/token (heavily
gated). Sequenced cheapest+safest first.

## Founder council debate (see FOUNDER_COUNCIL_12H_DEBATE.md)

Consensus risks: invisibility, no traction, anonymous team, no audit/RLS proof,
fabric-is-P0-if-rushed, token-need-undemonstrated. Top survival move: make the
existing rigor publicly legible (researcher pack + repro + narrative + SECURITY.md)
before building anything new.

## Safe fixes applied

Documentation only: created the full research workspace; formatted all new docs to
pass prettier; added a pointer in CRYPTO_VISIBILITY_001_ROADMAP. No code changed →
`pnpm check` remained 490/490.

## PRs created / merged

- Merged before sprint: #63 (V-5 hardening) → main `16c83f5`.
- This sprint: draft PR for `claude/12h-crypto-visibility-agent-fabric` (docs-only).

## Test results

Baseline 490/490; final 490/490 (74 files); doctrine guards green. No code changes.

## Verified facts / likely inferences / unknowns

See VERIFIED_FACTS.md, LIKELY_INFERENCES.md, UNKNOWNS_AND_BLOCKERS.md.

## Recommended next build

The **public researcher pack + "verify it yourself" repro guide + SECURITY.md**
(cheap, public-safe, no founder gate) — it converts Cognitia's existing rigor into
externally legible, reproducible evidence, which the council and lanes agree is the
single highest-leverage move.

## 48-hour plan

Researcher pack + repro guide + safe narrative + SECURITY.md draft (all public-safe).
Founder: decide team page (D-4), provide dev DB (D-2), flip default branch (D-7),
optionally paste the video transcript (D-1).

## 30-day plan

V-6 managed-Postgres RLS verification; one pilot's public-safe proofs; standards-
mapping page; assurance-bond simulation (credits, no token); fabric Stage-1 local
prototype (post security sign-off); external audit scoping.
