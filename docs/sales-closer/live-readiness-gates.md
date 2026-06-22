# Demandara Sales Closer — Live Readiness Gates

> **Status legend:** `REAL` · `SANDBOX` · `PLANNED` · `MOCK`.
>
> **Greenfield notice:** Everything here is `PLANNED`. **No live channel is enabled.** This document defines the conditions that would have to be met *before* any live call, email, SMS, or WhatsApp message could occur. It does not authorize any of them. Nothing in this repository may initiate real outreach until the release gate below is fully satisfied and signed.

See also: `superiority-plan.md` (main spec) and `salescloser-gap-map.md` (gap table).

---

## 1. Live channel readiness checklist

Per-channel readiness items. A channel is **never** "ready" until every box is checked *and* the release gate (Section 2) passes. Until then each channel stays at `MOCK` with the Egress Guard `CLOSED`.

| Area | Item | Status |
|------|------|--------|
| Legal | Lawful basis documented per jurisdiction (consent / legitimate interest) | `PLANNED` |
| Legal | Telemarketing / e-mail / messaging regulations mapped (e.g. TCPA, CAN-SPAM, GDPR/ePrivacy, CASL, local equivalents) | `PLANNED` |
| Legal | Counsel sign-off on script, disclosures, and opt-out language | `PLANNED` |
| Consent | Verifiable consent record exists for each contact | `PLANNED` |
| Consent | Suppression / do-not-contact list enforced at the gate | `PLANNED` |
| Consent | Opt-out honored within required window, recorded as proof | `PLANNED` |
| Scope | Signed customer scope defining who may be contacted, when, how | `PLANNED` |
| Deployment | Staged rollout config, rate limits, time-of-day windows | `PLANNED` |
| Deployment | Connector to live vendor formally approved and credentialed | `PLANNED` |
| Security | Secrets management, least-privilege access, encryption in transit/at rest | `PLANNED` |
| Security | PII handling and retention policy enforced | `PLANNED` |
| Observability | Real-time monitoring, alerting, and per-action proof receipts | `PLANNED` |
| Control | Kill switch tested and reachable by on-call operator | `PLANNED` |
| Control | Human approval recorded for the live campaign | `PLANNED` |

---

## 2. Release gate (ALL conditions must be TRUE)

This is the single decision point that converts a channel from `MOCK` to live. The Egress Guard returns `PASS` **only** when **every** condition below is simultaneously true and recorded. If any one is false, the gate returns `BLOCKED` and no external transmission is possible.

1. **Legal sign-off owner.** A named legal/counsel owner has signed off on the specific channel, script, disclosures, and jurisdictions. Sign-off is recorded with identity and date.
2. **Signed customer scope.** The customer has signed a scope document defining contact eligibility, channels, volumes, and time windows. The campaign config matches the signed scope exactly.
3. **Consent records.** Every target contact has a verifiable consent record, and the suppression list is enforced at the consent/compliance gate (pipeline stage 2).
4. **Deployment controls.** Rate limits, time-of-day windows, volume caps, and staged rollout are configured and active.
5. **Security controls.** Secrets are vaulted, access is least-privilege, data is encrypted in transit and at rest, and PII retention rules are enforced.
6. **Observability.** Real-time monitoring, alerting, and 100% per-action proof receipts are live before the first real action.
7. **Kill switch.** A tested kill switch can halt all egress immediately and is reachable by the on-call operator.
8. **Connector approval.** The specific live vendor connector is formally reviewed and approved; credentials are present only in the approved environment.
9. **Human approval.** A named operator has approved the live campaign through pipeline stage 3, recorded as proof.

> **Founder + counsel + customer triple sign-off** is required for the gate to be flipped. Engineering cannot enable live channels unilaterally.

Gate evaluation (conceptual):

```
egress = PASS  ⇔  legal_signoff
                ∧ signed_scope
                ∧ consent_records
                ∧ deployment_controls
                ∧ security_controls
                ∧ observability
                ∧ kill_switch
                ∧ connector_approval
                ∧ human_approval
otherwise egress = BLOCKED   (current state for every channel)
```

---

## 3. Maturity ladder

Channels climb one rung at a time. Each rung has explicit **entry** and **exit** criteria. No rung may be skipped, and dropping a required condition demotes a channel down the ladder.

### Rung 1 — Mock-only `← current state`
- **What:** Adapters route to a null sink. No external transmission is even wired.
- **Entry:** Pipeline stages 1–3 exist; synthetic data only.
- **Exit:** Stages 4–7 produce proof receipts; Egress Guard confirmed default-CLOSED.

### Rung 2 — Dry-run
- **What:** Full conversations simulated end-to-end with proof artifacts; still zero egress.
- **Entry:** Mock-only exit criteria met.
- **Exit:** All SalesCloser capability equivalents (SC-1…SC-12) demonstrated in simulation with reviewable proof; multilingual coverage for launch languages.

### Rung 3 — Private pilot
- **What:** Internal-only / fully-consenting-test-audience exercises; **still no live outreach to real prospects.** Any "contact" remains sandboxed (`budget_wheels_demo` / Tenant Zero).
- **Entry:** Dry-run exit criteria met; security and observability controls in place.
- **Exit:** Clean audit of a full pilot run; kill switch tested; counsel review of pilot findings.

### Rung 4 — Controlled live
- **What:** First *real* outreach, narrowly scoped, low volume, heavily monitored.
- **Entry:** **Release gate (Section 2) fully PASS**, including triple sign-off. Connector approved for a limited scope.
- **Exit:** Sustained clean compliance and observability metrics over the controlled window; no unresolved incidents.

### Rung 5 — Production live
- **What:** Broader live operation within signed scope and ongoing governance.
- **Entry:** Controlled-live exit criteria met; counsel + customer renew sign-off for expanded scope.
- **Exit (ongoing):** Continuous monitoring; gate re-evaluated on any scope, vendor, or jurisdiction change. Any failure demotes the channel.

```
Mock-only ──► Dry-run ──► Private pilot ──╳── Controlled live ──► Production live
                                          ▲
                              RELEASE GATE (Section 2)
                          founder + counsel + customer
```

---

## 4. What remains blocked until approval

Until founder, counsel, **and** customer approvals are all recorded and the release gate returns `PASS`, the following are **permanently blocked**:

- Any **live phone call** (inbound or outbound).
- Any **live email** send.
- Any **live SMS** or **WhatsApp** message.
- Any **live chat** with a real prospect.
- Any **write to a live/production CRM** (only sandbox mirrors are permitted).
- Any **vendor API** call that produces external effect (telephony, messaging, CRM, scraping).
- Any **storage of real customer or prospect PII** in the Sales Closer pipeline.

These remain `BLOCKED` regardless of how high pipeline readiness scores. A high readiness number (even 80+) reflects *simulation maturity and governance readiness* — it is explicitly **not** a production-readiness or live-authorization claim.
