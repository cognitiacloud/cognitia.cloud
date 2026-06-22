# Automation Consent & Compliance Readiness Controls

Status labels used below: **REAL** (in production use), **SANDBOX** (Tenant Zero
/ `budget_wheels_demo` only), **MOCK** (in-memory fake, no IO), **PLANNED**
(not built; future lane).

> **Not legal advice.** This module implements internal **readiness controls** —
> the checks an operator/compliance reviewer expects to see pass before any
> progression toward live outreach. It is **MOCK/SANDBOX** and makes no claim
> that a cleared action is lawful, nor that a blocked action is unlawful.
> Whether outreach is actually compliant (e.g. under Canada's CASL or Quebec's
> Law 25) is a determination for qualified counsel, made out-of-band. Nothing
> here sends anything, touches the network, vendor SDKs, secrets, or raw PII.

## Purpose

A pure, deterministic gate that decides whether a single planned automation
action is **cleared, from a consent-readiness standpoint, to proceed to dry-run
planning**. It sits upstream of the dry-run channel engine as an additional,
explicit consent/compliance checkpoint. It **fails closed**: unknown, ambiguous,
missing, revoked, or expired consent **blocks**; the empty/default input blocks.

Source:

- `packages/agents/src/closer/automationConsent.ts` — readiness gate.
- `packages/agents/src/closer/automationConsent.test.ts` — tests.

## Outcomes

`evaluateAutomationConsent(input)` returns one of three outcomes:

| Outcome           | Meaning                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| `cleared`         | Explicit, current consent and no blocking/review signal. Plan may proceed to dry-run. |
| `requires_review` | No hard block, but an out-of-band human compliance review is required first.          |
| `blocked`         | At least one hard block applies. The action must not proceed.                         |

`cleared` is the **only** outcome that authorizes proceeding. `requires_review`
is intentionally **not** cleared — it must wait for the review to land. Even a
cleared outcome only authorizes a **dry-run plan**, never a live send (the
dry-run channel engine and live-release gates remain in force downstream).

## Signals

Each result carries an ordered `signals[]` list (blocking first, then review),
plus `blockingCodes[]` and `reviewCodes[]`.

### Blocking signals (any one blocks)

| Code                             | Triggered when                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `no_consent`                     | `consentStatus === 'none'`                                                                         |
| `ambiguous_consent`              | `consentStatus === 'ambiguous'` (or an unknown/garbled status)                                     |
| `revoked_consent`                | `consentStatus === 'revoked'`                                                                      |
| `expired_consent`                | `consentStatus === 'expired'`, or `consentExpiresAt` is at/before `evaluatedAt`, or is unparseable |
| `do_not_contact`                 | `doNotContact === true` (suppression list)                                                         |
| `casl_explicit_consent_required` | `caslSensitive === true` and consent is not `explicit`                                             |
| `workspace_required`             | `workspaceId` missing or blank                                                                     |

### Review-only signals (escalate when not otherwise blocked)

| Code                              | Triggered when                                               |
| --------------------------------- | ------------------------------------------------------------ |
| `law25_extra_review_required`     | `law25Flag === true` (Quebec / Law 25) — always extra review |
| `implied_consent_review_required` | `consentStatus === 'implied'` — implied consent has limits   |

## Decision order

1. Gather every applicable signal.
2. If any **blocking** signal is present → `blocked` (blocking always wins; a
   Law 25 flag never downgrades a hard block).
3. Else if any **review** signal is present → `requires_review`.
4. Else → `cleared`.

## Design notes

- **Pure & deterministic.** No `Date.now` in the hot path: `evaluatedAt` is
  injectable (defaults to now only when omitted). Same input → same output.
- **No PII.** Inputs are state and identifiers only — no names, emails, or
  phone numbers. Consistent with the wider GTM lanes' `assertNoRawPii` posture.
- **CASL-sensitive ⇒ explicit only.** Implied consent does not clear a
  CASL-sensitive (commercial-electronic-message) action; it blocks.
- **Quebec / Law 25 ⇒ extra review.** The flag escalates to `requires_review`
  rather than auto-clearing, reflecting heightened review expectations.

## Status

- Readiness gate + tests: **MOCK / SANDBOX**.
- Wiring into the live workflow run path (consuming real consent records): **PLANNED**.
- Any live outreach: **PLANNED** and blocked until counsel/customer/founder
  signoff lands out-of-band (see `docs/security/live-release-gates.md`).
