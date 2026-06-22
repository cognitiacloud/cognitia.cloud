# What Remains Prohibited

> A do-not-do list for anyone running the Demandara/Cognitia demo or writing
> external collateral from this checkout. Scoped to the **current Hermes Vision
> checkout**. When unsure, label it **mock / sandbox / planned** and move on.

For each item: the rule, why, and the safe phrasing to use instead.

## 1. No fake customers

- **Don't:** name, imply, or invent any customer, design partner, or user.
- **Why:** there are none in this checkout; implying otherwise is false.
- **Say instead:** "We are preparing our first pilot (Client Zero is a
  template, not a live engagement)."

## 2. No fabricated metrics

- **Don't:** show counts, conversion rates, time-saved, accuracy, or any number
  presented as a result. Do not claim a specific passing-test count unless it
  has been run and verified on this branch.
- **Why:** no metrics or dashboards exist in this checkout.
- **Say instead:** "The repo includes a synthetic unit test suite; verify
  count/status before any demo."

## 3. No crypto / fundraising hype language

- **Don't:** use crypto/fundraising hype framing (price-action, returns,
  pre-sale, or valuation promises) anywhere in collateral.
- **Why:** off-message and unverifiable; invites compliance risk.
- **Say instead:** describe the actual control surface in plain language.

## 4. No SOC2 certification claim

- **Don't:** say "SOC2 certified", "SOC2 compliant", or imply an audit exists.
- **Why:** there is no audit, report, or certification.
- **Say instead:** "early SOC2-readiness preparation for the Hermes Vision
  control surface" — narrowly that control surface, never company-wide, never
  certification.

## 5. No "guaranteed results"

- **Don't:** guarantee outcomes, performance, or compliance.
- **Why:** unverifiable and creates liability.
- **Say instead:** "Here is exactly what the tool does today, and here is what
  is planned."

## 6. Budget Wheels stays sandbox

- **Don't:** present Budget Wheels as live, as a customer, or as in production.
- **Why:** it exists only as `budget_wheels_demo` / Tenant Zero sandbox.
- **Say instead:** "Budget Wheels runs in the Tenant Zero sandbox
  (`budget_wheels_demo`) unless the founder has confirmed consent for a real
  tenant." No confirmed consent → it stays sandbox on screen.

## 7. No content-provenance shipping claim

- **Don't:** claim C2PA or content provenance signing is shipping or available.
- **Why:** it is a research direction (branch name) only; not implemented.
- **Say instead:** "Content provenance is on the roadmap; not in this build."

## 8. No real PII in demo/test assets

- **Don't:** load real personal data, real credentials, or real financial
  details into any demo or test asset.
- **Why:** the privacy scanner is meant to *catch* these; demoing with real
  data defeats the purpose and creates exposure.
- **Say instead:** use the repo's synthetic `test_assets/` only.

## 9. Don't present planned/brand items as shipped

- **Don't:** let Demandara (brand), Sales Closer / proof-governed GTM
  (workflow), Trust Center automation, dashboards, or Client Zero read as
  implemented.
- **Why:** they are MOCK / PLANNED in this checkout — see
  [real-vs-mock.md](./real-vs-mock.md).
- **Say instead:** "This is the motion/framing; implementation is planned
  (separate branch)."

## Related

- [Trust Center hub](./README.md)
- [Real vs Mock](./real-vs-mock.md)
- [Claim provenance table](./claim-provenance.md)
