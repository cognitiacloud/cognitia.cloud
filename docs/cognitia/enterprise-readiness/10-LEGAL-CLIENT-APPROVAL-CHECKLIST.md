# 10 — Legal / Client Approval Checklist

**Purpose:** The legal and client gate required before any `live` consideration.
Human-attested evidence (`legal_client_approval` in #03). Without this **and**
#09, mock-safe is never disabled and no connector goes live.

> Going live touches real people and real data. This checklist must be signed by
> counsel/authorized client contact — never by automation.

## Legal / compliance

- [ ] Outreach channel(s) reviewed against applicable law (e.g. CAN-SPAM, CASL,
      GDPR/ePrivacy, TCPA where relevant) for the target geography.
- [ ] Lawful basis / consent model documented for any contact data processed.
- [ ] Suppression / opt-out handling verified end-to-end (honored before any send).
- [ ] Data Processing Agreement / sub-processor terms in place for each connector
      that would go live (#08).
- [ ] PII handling reviewed: storage minimization, hashing, retention (#02).
- [ ] Incident notification obligations and timelines understood (#05).

## Client authorization

- [ ] Client has authorized live operation in writing, scoped to named
      audiences/segments.
- [ ] Client has approved message content / brand voice and any claims made.
- [ ] Client-side owner and escalation contact identified.
- [ ] Volume, rate limits, and quiet-hours constraints agreed.
- [ ] Rollback / kill-switch expectations communicated (#06).

## Decision

- **Live operation approved:** YES / NO  (NO keeps the platform mock-safe)
- **Scope / audience:** `____________`
- **Counsel:** `____________`  **Date:** `____________`
- **Client authorized contact:** `____________`  **Date:** `____________`
- **Audit:** record `approval.legal.recorded.v1` with signature refs and scope.

## Standing condition

If any item above is unchecked or stale, the release gate (#03) keeps `live`
blocked and connectors remain `dark` (#08). This is the fail-closed default.
