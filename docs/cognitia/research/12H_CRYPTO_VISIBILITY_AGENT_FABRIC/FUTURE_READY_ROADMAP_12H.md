# Future-Ready Roadmap (LOOP 6)

Per item: why · evidence it creates · risk · effort · dependency · acceptance ·
owner · visibility (public/internal/private). Effort S/M/L. All gated items noted.

## A. Immediate safe (days; mostly no founder gate)

### A1. #63 V-5 feed hardening — **DONE/merged**

why: feed safety · evidence: 490/490 on main · risk: none · effort: — ·
dependency: — · acceptance: merged (`16c83f5`) · owner: session · visibility: public.

### A2. Researcher docs + "verify it yourself" repro guide

why: convert rigor to legible evidence · evidence: reproducible 490 + smoke ·
risk: low · effort: S · dependency: none · acceptance: outsider reproduces 490 ·
owner: session · visibility: public.

### A3. Safe public narrative + compliance-posture note

why: coherent, defensible story · evidence: consistent messaging · risk: low ·
effort: S · dependency: none · acceptance: narrative reused verbatim · owner:
session/founder voice · visibility: public.

### A4. Video reconciliation placeholder

why: honest handling of unfetchable video · evidence: integrity · risk: none ·
effort: S (done) · dependency: founder paste · acceptance: transcript reconciled ·
owner: founder · visibility: internal.

### A5. Team page draft

why: anonymity is the top trust gap · evidence: named team · risk: founder choice ·
effort: S · dependency: founder identity decision (D-4) · acceptance: page drafted ·
owner: founder · visibility: public.

### A6. Managed Postgres RLS plan (exists) + trust-feed config plan (exists)

why: name the gaps · evidence: plans on file · risk: none · effort: — ·
dependency: dev DB / founder · acceptance: plans current · owner: session ·
visibility: internal→public summary.

## B. Near-term product (weeks)

### B1. Managed-Postgres RLS verification (V-6)

why: top technical credibility gap · evidence: RLS holds under restricted role ·
risk: low · effort: M · dependency: **dev DATABASE_URL (D-2)** · acceptance: plan
runs green under nosuperuser · owner: session+founder · visibility: public summary.

### B2. Tenant Zero / Demandara pilot proof

why: traction is the weakest axis · evidence: real public-safe proofs · risk: med ·
effort: L · dependency: founder pilot · acceptance: one referenceable pilot ·
owner: founder · visibility: public (gated).

### B3. Public-safe proof feed configuration

why: make `/trust/live` real · evidence: live redaction-passed projections ·
risk: med · effort: S · dependency: B1 + trustProxy + edge limits (D-8) ·
acceptance: non-empty feed reproducible · owner: founder · visibility: public.

### B4. SEC-2 audit export onto mainline

why: portable audit trail · evidence: exportable audit · risk: low · effort: M ·
dependency: none · acceptance: audit export on main + tests · owner: session ·
visibility: internal.

### B5. Marketplace detail pages + B6. Work-order templates

why: product depth + more proofs · evidence: richer demos · risk: low · effort:
M each · dependency: none · acceptance: pages/templates + tests · owner: session ·
visibility: internal (authed).

### B7. API/SDK docs + B8. SECURITY.md

why: integration + security legibility · evidence: docs · risk: low · effort: S/M ·
dependency: none · acceptance: published · owner: session · visibility: public.

### B9. Agent fabric prototype plan (Stage 1)

why: de-risk the fabric · evidence: local single-node receipt · risk: med ·
effort: M · dependency: security sign-off · acceptance: Stage-1 acceptance met ·
owner: session+founder · visibility: internal.

## C. Agent Fabric (gated; design→prototype)

node registry · Tailscale connector plan · capability registry · model router ·
local/cloud router · execution receipts · policy approvals · node reputation ·
fabric marketplace. why: distribution moat + resilience · evidence: verifiable
remote work · risk: P0-security (see containment model) · effort: L · dependency:
MVP_ROADMAP stages + founder auth per stage · acceptance: per-stage in MVP_ROADMAP ·
owner: session+founder · visibility: internal until proven.

## D. Protocol / future token (heavily gated)

stablecoin settlement sandbox (after legal gate) · verifier/arbiter roles ·
assurance-bond simulation (credits, no token) · local-only token sandbox (later) ·
EAS/ERC-8004 compatibility spike (design) · x402 sandbox adapter · **no mainnet**.
why: cross-boundary assurance · evidence: sandbox mechanics · risk: P0-legal ·
effort: L · dependency: **legal opinion (D-5)** + all TOKEN_GATES · acceptance:
sandbox-only, gated · owner: founder+counsel · visibility: internal/private.

## Sequencing recommendation

A2/A3/B7-SECURITY (cheap, public, high) → B1 RLS (dev DB) → A5 team + audit
(founder) → B3 live feed → C Stage 1 fabric → D design spikes. Never let C/D ship
capability before its security/legal gate.
