# V2-5 Founder / Operator Demo Video Script + Storyboard

**Boundary line for narration:** This is a local mock demo using reserved fake data. It is not live customer use, not production, not outreach, not live CRM execution, not provider/API execution, not revenue, and not Alta parity.

| Time | Visual | Narration |
|---|---|---|
| 0:00-0:15 | Title: Budget Wheels local demo | "This is the Demandara Sales Closer spine running inside Cognitia TrustOps controls, using fake Budget Wheels demo data." |
| 0:15-0:35 | Lead fixture | "A reserved fake lead enters the system. The workflow validates intake fields and reserved demo data before anything else." |
| 0:35-0:55 | Qualification + consent | "The lead is qualified only if budget, vehicle interest, and consent are valid. Missing consent blocks before writeback." |
| 0:55-1:20 | Approval gate | "Human approval is no longer a plain status flag. It is bound to reviewer identity, event source, and a deterministic receipt hash." |
| 1:20-1:40 | Mock writeback | "The system writes only to a mock CRM adapter. The output explicitly says live_crm false." |
| 1:40-2:05 | Proof receipt | "Every stage emits a hash. The receipt shows what happened, why, and the explicit risk language." |
| 2:05-2:25 | Static proof viewer | "The operator can inspect the trace and proof receipt locally. No live endpoints, no action controls." |
| 2:25-2:40 | Blocked personas | "A missing-consent lead and high-risk invalid lead both block before writeback." |
| 2:40-3:00 | Close | "This proves a local governed demo path. Controlled-live remains blocked until real reviewer signatures, CRM authorization, and external review are complete." |
