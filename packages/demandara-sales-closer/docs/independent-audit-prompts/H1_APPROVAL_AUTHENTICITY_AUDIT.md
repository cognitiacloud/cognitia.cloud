# H1_APPROVAL_AUTHENTICITY_AUDIT.md

Read-only Claude/Manager audit prompt.

Scope: `packages/demandara-sales-closer` in product-spine hardening worktree.

Focus: approval authenticity hardening and status-only rejection.

Hard boundary: no writes, no push, no PR mutation, no merge, no deploy, no provider/API calls, no live CRM/outreach, no secrets, no dependency install.

Return bucket: PASS, PASS_WITH_EXPLICIT_RISK, NEEDS_FIX, BLOCKED_ENVIRONMENT, UNKNOWN. Include exact files inspected, tests run, and explicit risks.
