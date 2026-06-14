# LANE M — Skeptic Researcher Questions (the attack)

**Objective**: Enumerate what a hostile-but-fair researcher will attack, with the
honest answer Cognitia can give today.

| # | Attack question | Honest answer today | Status |
| - | --------------- | ------------------- | ------ |
| 1 | "Who are you? Anonymous team = risk." | Team not yet publicly named. | GAP (D-4) |
| 2 | "Is any of this real or just docs?" | 490 tests on 2 backends; runtime smoke; PR history. | STRONG |
| 3 | "Has anyone audited it?" | No external audit yet; internal controls + RLS plan. | GAP (D-?) |
| 4 | "Does the multi-tenant isolation actually hold?" | RLS + GUC + redundant predicates, tested; managed-RLS under restricted role NOT yet verified. | PARTIAL (U-2) |
| 5 | "Is there a token? Are you fundraising?" | No token, no sale, no payments; gated + optional. | STRONG |
| 6 | "Why would a token ever be needed?" | Only as assurance collateral (bond/slash); legal+usage gated; may never launch. | STRONG (honest) |
| 7 | "Any real users / revenue?" | No public traction evidence yet. | GAP (U-4) |
| 8 | "Can I reproduce your claims?" | Clone + `pnpm check` (490) + run economy smoke. | STRONG (make it explicit) |
| 9 | "Is the public feed an enumeration/leak risk?" | Config-only tenant, deny-by-default, allowlist projection, aggregate reputation, rate-limited. | STRONG |
| 10 | "Are you overclaiming decentralization/production?" | Explicit "what we do not claim" page; not production, not SOC2, not decentralized. | STRONG |
| 11 | "Standards or NIH?" | Maps to ERC-8004/x402/VC/MCP; external anchoring design-only. | PARTIAL |
| 12 | "What stops you from rugging?" | No token/treasury to rug; internal credits non-transferable. | STRONG |

## Findings
- `likely_inference` — Cognitia *wins* most attacks (2,5,6,8,9,10,12) and *loses*
  on team identity (1), external audit (3), managed-RLS proof (4), traction (7).
- The losses are all closable and already tracked.

## Recommended actions
- Pre-empt the attacks: publish a "Researcher FAQ — hard questions" that answers
  1–12 honestly. (Extend existing RESEARCHER_FAQ.)

## Unsafe claims to avoid
Don't bluff answers to 1/3/4/7; honesty is the moat here.
