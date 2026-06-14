# LANE K — Security & Audit Expectations

**Objective**: The security bar B2B + crypto researchers expect.

**Sources (WebSearch)**: SOC 2 for startups 2026 (graygroupintl, sprinto,
workstreet, konfirmity); startup vulnerability-testing guide (cybri.com); LANE C
audit sources (CertiK/Trail of Bits/ConsenSys Diligence norms).

## Findings

- `likely_inference` — For B2B SaaS, **SOC 2** is increasingly a de-facto sales
  gate; expectations in 2026 include least-privilege, MFA, network segmentation,
  zero-trust, continuous risk assessment, vendor management.
- `likely_inference` — Early-stage best practice is a **formal pentest** + fix
  cycle first; a **bug-bounty** comes once the app is mature.
- `likely_inference` — Crypto researchers additionally expect **code audits** by
  reputable firms before trusting funds-handling code.
- `verified_fact` — Cognitia is NOT SOC 2 certified and has NO external audit yet;
  it must not claim either. It DOES have strong internal controls: RLS tenant
  isolation, append-only/audit events, deny-by-default permissions, doctrine
  guards, secrets-not-hardcoded, a documented RLS verification plan.

## Relevance to Cognitia

The honest security story is "strong internal controls + tested isolation, with
external audit and managed-RLS verification as named, tracked gaps." That is
credible _if_ the gaps are stated, not hidden.

## Gaps

- No external audit; no pentest report; no bug-bounty intake; no public SECURITY
  page / responsible-disclosure contact; managed-RLS unverified (V-6).

## Recommended actions

- Publish a `SECURITY.md` (threat model summary, secrets policy, disclosure
  intake email) — design in LOOP 4/8.
- Founder: budget an external pentest/audit (D-?), and provide a dev DB to close
  the managed-RLS gap (V-6).

## Public-safe wording

"Cognitia enforces tenant isolation (Postgres RLS), append-only audit trails, and
deny-by-default permissions. External audit and managed-Postgres RLS verification
are tracked, not yet complete."

## Unsafe claims to avoid

No "SOC 2 certified," "audited," "pentested," or "secure/unhackable" claims.
