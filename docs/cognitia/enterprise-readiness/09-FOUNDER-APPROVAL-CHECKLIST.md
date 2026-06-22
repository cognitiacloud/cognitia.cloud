# 09 — Founder Approval Checklist

**Purpose:** A founder-only gate that must be signed before any `pilot-dark`
promotion and is a precondition (alongside #10) for ever considering live.
Automation can never satisfy this — it is human-attested evidence
(`founder_approval` in #03).

> No state change, live action, or PR merge proceeds without explicit founder
> approval recorded here.

## Sign-off items

- [ ] I have reviewed the change scope and confirm it matches intent.
- [ ] I confirm **mock-safe mode is ON** and all connectors are `dark` (#08).
- [ ] I confirm **no live outreach, no vendor API execution, no real CRM writes**
      are enabled by this change.
- [ ] I confirm **dry-run actions are `sent: false`** and no `sent: true` exists.
- [ ] I confirm **no raw PII** is stored or logged (audit payloads are refs/hashes).
- [ ] I confirm **no production secrets** are present (safety scan green).
- [ ] I have reviewed the release-gate evidence (#03) and accept any open risks.
- [ ] I have reviewed the rollback plan (#06) and rehearsal proof.
- [ ] I understand monitoring will page on any live-action attempt (#04).

## Decision

- **Approved for stage:** `____________` (dev | mock-staging | pilot-dark)
- **Explicitly NOT approved for:** `live` (requires separate #10 + mock-safe
  disable decision)
- **Founder:** `____________`  **Date:** `____________`
- **Audit:** record `approval.founder.recorded.v1` with the signature ref and the
  release ref. The boolean is never self-asserted by automation.

## Notes / conditions

`____________________________________________________________`
