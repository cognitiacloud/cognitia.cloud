# Local verification notes

No headless browser is available in this environment, so screenshots are not
attached. Verification was done via Node smoke tests against the same data and
render code the browser uses. To capture screenshots, open `index.html` (or
serve it, see README) and grab the panels described below.

## 1. Fixture / safety invariants — `node verify.mjs`

```
✓ fixtures loaded
✓ data is flagged mock-fixtures
✓ LEAD-CZ-0001: email uses .example
✓ LEAD-CZ-0001: phone uses 555-01xx
✓ LEAD-CZ-0001: draft is preview_only
✓ LEAD-CZ-0001: valid compliance state
✓ LEAD-CZ-0001: human-approval gate present
✓ LEAD-CZ-0001: no finance/APR claims
✓ LEAD-CZ-0002: email uses .example
✓ LEAD-CZ-0002: phone uses 555-01xx
✓ LEAD-CZ-0002: draft is preview_only
✓ LEAD-CZ-0002: valid compliance state
✓ LEAD-CZ-0002: BLOCKED lead has a block reason code
✓ LEAD-CZ-0002: human-approval gate present
✓ LEAD-CZ-0002: finance/APR claim ⇒ BLOCKED

ALL CHECKS PASSED
```

## 2. Render path + approval gate (DOM shim)

```
render executed; rail items: 2 main sections: 4
approve-on-BLOCKED recorded? false (expected false)
approve-on-approvable recorded? approved (expected approved)
```

This confirms:

- The console renders both sample leads and all panels without errors.
- The human-approval hard gate works: a `BLOCKED` lead **cannot** be approved;
  an approvable lead can.

## 3. Manual checklist (when viewed in a browser)

- [ ] Amber "SANDBOX / MOCK DATA" banner is visible at the top.
- [ ] Lead rail shows two leads with compliance badges.
- [ ] **LEAD-CZ-0001** (`NEEDS_REVIEW`): Approve enabled, claim scan all zero,
      draft visible as preview only (no send button anywhere).
- [ ] **LEAD-CZ-0002** (`BLOCKED`): Approve **disabled**, reason codes show
      `CONSENT_MISSING` + `FINANCE_CLAIM_DETECTED`, claim scan shows non-zero
      finance/APR counts in red.
- [ ] Clicking Approve/Reject appends an `operator` row to the proof log.
