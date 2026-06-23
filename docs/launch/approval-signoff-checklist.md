# Approval Sign-off Checklist (Founder / Legal / Client)

> **STATUS: MOCK / SANDBOX.** This is the gate that must be satisfied
> **out-of-band** before any controlled-live step. Until every sign-off below is
> recorded, going live stays **BLOCKED**. Nothing in this repo can self-grant
> these approvals; asserting them in code only models that an out-of-band
> attestation exists.

Source / ties:

- Release gate inputs `founderSignoff`, customer-scope, legal sign-off in
  `packages/agents/src/closer/automationReleaseGate.ts` and
  `packages/agents/src/security/releaseGate.ts` (both fail closed without them).
- Approvals surface: `apps/web/src/app/approvals/`,
  `apps/web/src/lib/approvalQueue.ts`.
- `docs/security/live-release-gates.md`, `docs/launch/go-live-checklist.md`,
  `docs/launch/review-log.md`.

## Sign-offs required (all mandatory, fail-closed)

### 1. Founder sign-off

- [ ] Founder has reviewed scope, risk register, and the readiness scorecard.
- [ ] Founder explicitly authorizes the specific controlled-live action(s).
- [ ] Recorded in `docs/launch/review-log.md` with date + named approver.

### 2. Legal sign-off

- [ ] Outreach/automation reviewed for consent and applicable regulations
      (e.g. anti-spam, GDPR/PIPEDA where relevant).
- [ ] Data processing / sub-processor posture acceptable; DPAs in place where
      required.
- [ ] No raw-PII handling beyond what is documented and permitted.
- [ ] Counsel recorded sign-off (date + name).

### 3. Client / customer sign-off

- [ ] Customer has signed the **scope** of what may be acted on (which
      contacts, channels, actions).
- [ ] Customer consent basis confirmed for each channel.
- [ ] Customer-side point of contact + escalation path recorded.

## Pre-conditions that must already be green

Approvals are not sought until the platform side is ready:

- [ ] Readiness scorecard reviewed (`docs/security/enterprise-readiness-scorecard.md`).
- [ ] Monitoring live (`monitoring-rules.md`, `monitoringStatus=active`).
- [ ] Rollback ready (`runbooks/rollback.md`, `rollbackStatus=ready`).
- [ ] Secrets policy satisfied (`secrets-policy.md`).
- [ ] Tenant isolation checklist passed (`tenant-isolation-checklist.md`).
- [ ] Deployment verification passed (`runbooks/deploy-verification.md`).

## Decision

Only when **every** box above is checked may the release gate be asked to
evaluate `controlled_live_authorized`. Any missing sign-off ⇒ the gate returns
`blocked` and the action stays in dry-run. Record the final decision (approve /
hold) with timestamp in `docs/launch/review-log.md`.
