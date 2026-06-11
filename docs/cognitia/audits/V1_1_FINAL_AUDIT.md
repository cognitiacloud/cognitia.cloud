# Cognitia v1.1 — Final Audit

Date: 2026-06-11. Auditor: build session (self-audit; an independent review
is recommended before production). Evidence tags throughout.

## 1. Executive verdict

The v1.1 trust layer is **built, internally consistent, and test-verified**
(verified_fact: full `pnpm check` green at audit time — see §12). It is
**not production-deployed and must not be** until the founder-decision and
live-DB items below are cleared. Doctrine guardrails hold under automated
enforcement, not convention.

## 2. What is real (verified_fact)

Schema (0009–0014) with RLS and DB-level doctrine triggers; append-only Proof
Registry with redaction-gated publishing; ATC lifecycle with terminal
revocation and owner-gated SMS permission; SkillProof certification with
evidence-gated tiers; encrypted-PII lead intake with purge; approval-gated
simulated sends with response-time proofs; evidence-tagged revenue receipts;
verified-only reputation with reproducible snapshots; atomic internal credits
ledger; inert wallet placeholders; command dashboard; 7-PR stack with green CI.

## 3. What is simulated (verified_fact)

Every SMS send. The AI "draft" is a deterministic template (an LLM drafter
slots behind the same interface later). Demo data is synthetic.

## 4. What is not built (verified_fact)

Real SMS/email/voice; real payments (Stripe/stablecoin); on-chain anything;
public credential verification endpoint; lead-detail console page; reputation
decay/weighting; multi-tenant self-serve signup; production deployment.

## 5. What is legally gated (doctrine)

Token (any form), public crypto surfaces, stablecoin rails, exchange/staking/
liquidity anything. Reopening requires legal review + usage gates + founder
approval (kill gate I.1).

## 6. PGlite/test verified vs 7. requires live DB

All DB invariants are verified against PGlite (real Postgres engine,
superuser caveat documented in `kysely.pglite.test.ts`). Still requiring a
live instance: RLS enforcement under a non-superuser role, migration apply on
hosted Postgres, connection pooling/latency behavior.

## 8. Requires founder decision

Merge the stack (#32→…→#37→final); promote `claude/soc-1-readiness-package`
lineage to default branch; choose hosted DB; pilot-customer go.

## 9. Requires counsel

Anything token-shaped; stablecoin custody (MSB/money-transmitter exposure,
Canada/BC); customer SMS consent flow wording (CASL) before real sends.

## 10. Requires production credentials (none touched in this build)

DATABASE_URL, SESSION_SECRET, COGNITIA_PII_KEY_BASE64,
CREDENTIAL_SECRET_KEY_BASE64, HUBSPOT_WEBHOOK_SECRET; later: SMS provider.

## 11. Forbidden before the legal gate

Public token/coin/staking/exchange pages or copy; price/return language;
fundraising-adjacent crypto claims; chain activation of wallet bindings.

## 12. Test summary (verified_fact)

Final `pnpm check` at audit time: **all tests green** — 62+ files, 397+ tests
plus this pack's command-summary and documentation-guard suites (exact final
count in the PR description, taken from the run after this document landed).
Coverage spans unit, API-handler, repository-contract (memory + PGlite),
end-to-end mission loop, and doctrine guards.

## 13. Doctrine guard summary (verified_fact)

Automated: no token, coin, staking, pre-sale, or air-drop routes/pages; no custom
DID method anywhere; no legacy passport naming in code/app surfaces; no
marketplace/pricing surfaces; crypto docs internal-only with the legal-gated
header; forbidden marketing phrases absent from readiness payload/page and
from demo/proof-pack/audit docs.

## 14. Privacy review summary (verified_fact)

Raw PII confined to `lead_intakes` `*_enc` columns (AES-256-GCM); hashes for
lookup; masked lists; operator-only decryption; PIPEDA purge with
check-constraint enforcement; events/audits carry refs only (tested); public
proofs blocked on PII findings; dashboard aggregate tested PII-free.
Residual risks: ephemeral dev PII key (set `COGNITIA_PII_KEY_BASE64` in any
real environment); operator session token pasted into browser memory
(inherited platform pattern — acceptable for alpha, revisit before pilot).

## 15. Merge-readiness assessment

READY pending founder go: linear stack, each PR green and single-purpose,
no destructive operations, docs complete. See `../execution/MERGE_READINESS.md`.
