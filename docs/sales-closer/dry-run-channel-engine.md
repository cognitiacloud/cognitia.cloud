# Dry-Run Channel Engine

Status labels used below: **REAL** (in production use), **SANDBOX** (Tenant Zero
/ `budget_wheels_demo` only), **MOCK** (in-memory fake, no IO), **PLANNED**
(not built; future lane).

## Purpose

A **dry-run-only** channel orchestration layer. Every channel can _plan_ an
action but **never sends**. Any attempt to go live **fails closed** — it throws
rather than degrading to a real send. This is the deliberate safety boundary
for the GTM/Sales-Closer work: outreach logic can be exercised end-to-end with
zero risk of live contact, ads, or CRM writes.

Source:

- `packages/agents/src/channels/channelPolicy.ts` — policy gate + release gate.
- `packages/agents/src/channels/dryRunChannels.ts` — planning + fail-closed guards.

## Architecture

```
caller
  │  evaluateChannelPolicy(input)        ── MOCK pure gate
  ▼
ChannelPolicyDecision { allow, reasons }
  │  (allow authorizes a PLAN only, never a send)
  ▼
planDryRunAction(channel, input)         ── MOCK pure planner
  ▼
DryRunAction { mode:'dry_run', sent:false, wouldSendIfLive:{ liveStatus:'BLOCKED' } }
  │
  ├─ assertNoLiveSend(action)            ── runtime tripwire (throws if forged)
  └─ sendLive(...)                       ── ALWAYS throws "live channels disabled"
```

- **Pure & deterministic.** `planDryRunAction` and `evaluateChannelPolicy` are
  pure functions: no `Date.now`, no randomness, no IO, no network, no vendor
  SDKs. Same input → same output.
- **No network imports.** A test (`dryRunChannels.test.ts` → "source-level
  network/vendor scan") asserts the source contains no `fetch`, `axios`,
  `node:http(s)`, `net`, `tls`, `child_process`, `http(s)://`, or vendor names
  (twilio/sendgrid/hubspot/apify/nodemailer/etc).

## Fail-closed guarantee

Three independent layers each block a live send:

1. **Policy gate** (`evaluateChannelPolicy`) denies unless `consent === true`,
   `approval === 'approved'`, a non-empty `workspaceId` is present, AND the
   `live` flag is OFF. An allow authorizes a **dry-run plan only**.
2. **Planner** (`planDryRunAction`) is a pure function whose return type pins
   `sent: false` and `mode: 'dry_run'` as literals. It is structurally
   incapable of emitting a "sent" action.
3. **Guards**:
   - `assertNoLiveSend(action)` throws `LiveSendBlockedError` if `mode` is not
     `'dry_run'` or `sent` is not `false` (catches a forged/tampered object).
   - `sendLive(...)` **always throws** `"live channels disabled"`, for every
     channel and every input.

### Release-gate dependency (why live can never turn on here)

`sendLive` models a future contract by accepting a `ReleaseGate`, but the gate
is **impossible to satisfy in this layer**:

- `isReleaseGateOpen` requires all of `legalReviewComplete`, `consentVerified`,
  `signedReleaseApproval` to be `true` **and** `impossibleToken` to equal a
  private sentinel (`REQUIRED_RELEASE_TOKEN`).
- That sentinel is **not exported** and is **never assigned** to any gate this
  layer constructs. The only gate produced here, `IMPOSSIBLE_RELEASE_GATE`, has
  all-false flags and a token that can never match.
- Therefore no code path in this layer can open the gate. Even a caller forging
  an all-`true` gate cannot match the unavailable token. Tests prove this
  (`channelPolicy.test.ts` → "release gate (impossible to satisfy)" and
  `dryRunChannels.test.ts` → "sendLive ... cannot open").

**Any future live send must be a separate, legally-reviewed lane** that supplies
its own (non-impossible) gate after legal + consent sign-off. It is blocked
until then. **PLANNED** — not built here.

## Channel matrix

| Channel       | ChannelKind     | Dry-run plan | Live send | Status |
| ------------- | --------------- | ------------ | --------- | ------ |
| Email         | `email`         | yes          | BLOCKED   | MOCK   |
| SMS           | `sms`           | yes          | BLOCKED   | MOCK   |
| WhatsApp      | `whatsapp`      | yes          | BLOCKED   | MOCK   |
| Call          | `call`          | yes          | BLOCKED   | MOCK   |
| LinkedIn      | `linkedin`      | yes          | BLOCKED   | MOCK   |
| Ad            | `ad`            | yes          | BLOCKED   | MOCK   |
| CRM writeback | `crm_writeback` | yes          | BLOCKED   | MOCK   |

All seven plan deterministically; all seven have `liveStatus: 'BLOCKED'`.

## Data / safety constraints

- **No real PII.** Preview targets are synthetic only: `*.example` /
  `*.invalid` domains and `555-01xx` numbers. Defaults are encoded in
  `DEFAULT_TARGETS`.
- **Budget Wheels** appears only as `budget_wheels_demo` / Tenant Zero
  **SANDBOX** identifiers.
- No token/chain/wallet/payment/crypto. No production-readiness claims.

## Capability status summary

| Capability                              | Status                                |
| --------------------------------------- | ------------------------------------- |
| Policy gate (`evaluateChannelPolicy`)   | MOCK                                  |
| Dry-run planning (`planDryRunAction`)   | MOCK                                  |
| No-live-send guard (`assertNoLiveSend`) | MOCK                                  |
| Fail-closed `sendLive`                  | MOCK                                  |
| Release gate (impossible)               | MOCK                                  |
| Live channel sends (any channel)        | PLANNED (blocked until legal/consent) |
| Vendor/network integrations             | PLANNED (out of this lane)            |

## Verify

```
pnpm vitest run packages/agents/src/channels
```
