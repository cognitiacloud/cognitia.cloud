# CGD-002 CODEX_REVIEW

Ran: WSL /home/smrai/.hermes/node/bin/codex review --uncommitted --title CGD-002
Codex: OpenAI Codex v0.144.1
Session: 01a05e10-a4e1-7ff0-8892-b4a97fc0669f
Model: gpt-5.6-sol
Sandbox: read-only
PASS invented: no. No CODEX PASS claim.

Findings (honest):

1. P2 preserve readiness reports while live reads are disabled.
   checkHubspotReadiness threw LIVE_SURFACE_DENIED at the report entry before
   evaluating connectionStatus, so the operator-visible readiness endpoint would
   not return its documented not-ready report (paused / not_connected).
   Applied: removed the top-level throw. Property GETs remain gated inside
   HttpHubspotClient.listObjectProperties (before token/fetch). Deny is caught
   as failed property checks. Test added: paused + live client + flags off
   returns ready=false, fetch/token counts stay 0.
   This does not weaken deny-BEFORE-network.

No P1 listed. TS5097 .js imports: not applied (repo uses .ts sources with .js
specifiers). Codex was not re-run after applying the P2. This file is not a PASS.
Notes: bubblewrap missing warning; local MCP 127.0.0.1:9842 failed; Codex sandbox
vitest hit EROFS (read-only). Review completed.
