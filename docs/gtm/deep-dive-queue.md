# Deep-Dive Queue — Review These First

> The few branches on the critical path to Client Zero / Sales Closer / compliance. Everything else waits. For each, run the checklist; **do not close any duplicate loser until manager review.**

## Canonical-selection criteria (for duplicate sets)

Pick canonical by, in priority order:

1. **Scope fit to current roadmap** (dealership voice+text appointment-setter)
2. **Build/test health**
3. **Commit depth / completeness**
4. **Recency**
5. **Least architecture drift**
6. **Least security/compliance risk**
7. **Easiest path to merge/rebase**

Loser branches → **marked superseded candidates** with a pointer to the recommended canonical branch; **wait for manager review before closing anything.**

## Per-branch review checklist

For each deep-dive branch, capture: (a) what's actually implemented vs scaffold; (b) build/test status; (c) dependencies / merge order; (d) conflicts with `main`; (e) security/compliance flags; (f) recommended action (merge / rebase / hold / supersede).

## The shortlist

### 1. Sales Closer design of record

- `sales-closer-architecture-989w7r` (06-20)
- `sales-closer-engine-plan-c3quih` (06-20)
- **Goal:** determine the canonical design; confirm it targets voice **and** text on one lead identity. Resolve overlap.

### 2. Voice/text vendor posture (build-vs-buy)

- `sales-closer-vendor-readiness-u847qr` (06-20)
- `sales-closer-vendor-integration-porting` (06-20)
- **Goal:** which infra (Vapi/Retell/Twilio/etc.) is assumed; latency/telephony assumptions; how much is buy vs build.

### 3. Compliance foundation (legal gate)

- `feat/cognitia-compliance-layer-scaffold` (06-20)
- `cognitia-compliance-design-xpzaj3` (06-19)
- **Goal:** confirm TCPA/consent capture, call recording disclosure, opt-out handling, quiet-hours. **Blocks all outbound.**

### 4. Data spine

- `cog-002-schema-foundation` (06-11)
- **Goal:** confirm the lead/conversation/appointment schema; it is the merge-blocker for WS3/4/5. Establish merge order.

### 5. CRM round-trip (Client Zero proof)

- `hubspot-pilot-readiness-t7thv5` (06-15) — canonical candidate vs `…-71gwhd`
- `meeting-notes-hubspot-writeback` (06-15)
- **Goal:** prove a booked appointment writes back to the dealer CRM with provenance.

### 6. Pilot proof harness

- `pilot-001-proof-harness-a7aofs` (06-15) — canonical candidate vs `pilot-001-mainline-proof-harness`
- **Goal:** understand how an end-to-end pilot is demonstrated/measured (show-rate, booked appts).

### 7. Client Zero offer

- `auto-growth-dealership-proposal-22ntav` (06-20)
- **Goal:** confirm the dealership wedge (speed-to-lead + after-hours appointment-setter for the internet/BDC desk) and the ROI framing.

## Duplicate sets to resolve during deep-dive

| Set                 | Branches                                                          | Canonical (pending review) |
| ------------------- | ----------------------------------------------------------------- | -------------------------- |
| HubSpot readiness   | `…-t7thv5` · `…-71gwhd`                                           | `…-t7thv5`                 |
| Lead detail         | `…-console` · `cog-011-lead-detail` · `…-012-tenant-provisioning` | `…-console`                |
| Pilot proof harness | `…-a7aofs` · `pilot-001-mainline-proof-harness`                   | `…-a7aofs`                 |
