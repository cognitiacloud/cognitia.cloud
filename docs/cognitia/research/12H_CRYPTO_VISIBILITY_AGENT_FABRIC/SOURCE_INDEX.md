# SOURCE_INDEX — 12H Sprint

Sources consulted, grouped by lane. WebSearch result titles/URLs are recorded in
each lane file's "queries/sources used" section; this index is the consolidated
list plus standards primary sources. Egress note: direct page fetch (WebFetch/
curl) is blocked in this environment (403); `WebSearch` returns titles+URLs which
are cited, but full-text fetch of each page was not possible. Treat single-source
search snippets as `likely_inference` unless corroborated.

## Primary standards / protocol references (well-established, knowledge-grounded)

- **MCP (Model Context Protocol)** — Anthropic open standard for tool/context
  connection between models and external systems. (modelcontextprotocol.io)
- **A2A (Agent-to-Agent protocol)** — cross-agent interoperability spec
  (originated at Google, donated to the Linux Foundation).
- **ERC-8004 "Trustless Agents"** — Ethereum draft for on-chain agent identity,
  reputation, and third-party validation registries.
- **W3C Verifiable Credentials (VC) Data Model 2.0** — issuer/subject/claims/
  status credential model.
- **EAS (Ethereum Attestation Service)** — general on/off-chain attestations.
- **x402** — HTTP 402-based agent/automated payments pattern (Coinbase-originated).
- **Tailscale / WireGuard** — WireGuard is a modern VPN protocol; Tailscale is a
  mesh overlay built on it (identity-based, NAT-traversing).

## Search-grounded sources

See per-lane files under `deep-search/` for the specific WebSearch result
titles + URLs used in each lane. Crypto YouTube channel search (LOOP 1) returned
generic channel lists, not the target video.

## Cognitia in-repo evidence (primary, verifiable)

- `packages/db/migrations/0009_cognitia_trust_core.sql` (ATC, Proof Registry).
- `0010` (SkillProof, reputation), `0012` (credits ledger), `0013` (tier gate),
  `0016` (work orders + escrow), `0017` (disputes), `0018` (marketplace listings).
- `apps/api/src/{handlers,server,rateLimit,agentEconomy,marketplace}.ts`.
- `packages/db/src/repository.contract.ts` (memory + PGlite contract).
- `docs/cognitia/**` (architecture lock, token gates, runtime verification, V-4/4b/4c/5).
