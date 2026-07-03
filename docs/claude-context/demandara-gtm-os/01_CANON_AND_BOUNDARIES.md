# 01 — Canon and Boundaries

## Canon — preserve exactly

```text
B1 = OPEN
B2_B3 = OPEN_EVIDENCE_STRENGTHENED
B4 = OPEN_PENDING_REVIEW
B5 = OPEN_PENDING_REVIEW
BETA_1_RECOMMENDATION = NO
SCORE_MOVEMENT = NO
PROVIDER_INVENTORY_CERTIFIED = NO
ALTA_HELD_AT_60
SHIPPING_HELD_AT_22
HUMAN_B1_SEND = HELD_PENDING_POST_TOOLING_MANAGER2_W_REVIEW
```

## Interpretation

This packet does not promote Beta 1, certify provider inventory, move Alta above 60, move shipping above 22, authorize human B1 send, close B1/B4/B5, or authorize public/live/provider/API/CRM action.

## Build vs ship rule

Build aggressively. Audit aggressively. Plan aggressively. Ship conservatively.

Allowed in a future authorized builder lane:

- local source edits;
- local mock fixtures;
- local tests;
- docs and audit packets;
- no-egress checks;
- proof receipt skeletons.

Forbidden from this packet:

- live CRM writes;
- live provider/model/API calls;
- outreach to prospects/customers;
- public claims or publication;
- production migrations;
- secret/env access;
- raw PII processing;
- deployment.

## Evidence labels

Every future output should label evidence as one of: `IMPLEMENTED_LOCAL_MOCK`, `DOC_ONLY`, `DESIGN_ONLY`, `TESTED_LOCAL`, `BLOCKED_ENVIRONMENT`, `NEEDS_REVIEW`, or `NOT_VISIBLE_IN_THIS_REPO`.
