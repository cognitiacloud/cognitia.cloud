# H8 Budget Wheels 2-Minute Demo Script

**Safety line:** This is a local mock demo using reserved fake data. It is not live customer use, not production, not outreach, not CRM execution, and not a revenue claim.

## 0:00–0:20 — Problem

"Budget Wheels needs a safe way to triage inbound vehicle leads without letting AI send messages, touch CRM, or make claims unsupervised."

## 0:20–0:45 — Lead intake and qualification

Show the fake lead `bw-demo-001` entering the Demandara Sales Closer spine and becoming `QUALIFIED`.

## 0:45–1:05 — Consent and approval

Show consent passing, then the approval receipt bound to reviewer, event source, and deterministic receipt hash. Explain that status-only approval is rejected.

## 1:05–1:25 — Mock writeback

Show `MOCK_WRITTEN` with `live_crm:false` and `adapter:mock_crm_only`.

## 1:25–1:45 — Proof receipt

Show stage hashes, consent decision, approval decision, mock writeback, explicit risk text, and receipt hash.

## 1:45–2:00 — Operator console

Show `PROOF_RECEIPT_READY`, then state the boundary: local proof only; no live outreach/CRM/provider/API/deploy.
