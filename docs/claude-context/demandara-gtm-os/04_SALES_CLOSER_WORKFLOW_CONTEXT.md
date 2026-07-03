# 04 — Sales Closer Workflow Context

Sales Closer is the governed lead-to-close workflow within Demandara.

## CLOSER map

```text
C = Clarify
L = Label
O = Overview past pain
S = Sell the vacation
E = Explain concerns
R = Reinforce decision
```

## Target state machine

1. `lead_received`
2. `source_rights_checked`
3. `qualified_or_disqualified`
4. `trust_gap_identified`
5. `recommended_next_step_generated`
6. `human_approval_required`
7. `human_approved | human_denied | human_hold`
8. `mock_writeback_recorded`
9. `proof_receipt_generated`
10. `monthly_report_updated`

## Required fields

Use fake/reserved data only. Include lead id, scenario id, data mode, vertical, source type, source-rights status, consent status, contact allowed state, avatar segment, pain/problem category, desired outcome, trust gap, next-step recommendation, human approval status, and proof receipt id.

## Deny-by-default rules

- Unknown source rights: block external action.
- Missing consent: block external action.
- No human approval: block mock writeback and any future live writeback.
- Real PII in demo fixture: fail audit.
- Live connector configured in demo mode: fail audit.
