# CGD-001 SCOPE

Packet: Live-surface quarantine (HubSpot / Salesforce / Mira writes deny-by-default).
Repo: cognitia.cloud. Branch: packet/cgd-001-live-surface-quarantine.
This is an inventory + code-path quarantine on a packet branch. It is not a pentest
and not a production cutover. Live remains off.

Inspection (no vendor APIs called): packages/integrations, packages/agents,
packages/workflows, apps/api, apps/worker, .env.example.

## Surfaces

| Path | Vendor | Kind | Default state (this branch) | Gated? |
| --- | --- | --- | --- | --- |
| packages/integrations/src/hubspot/httpClient.ts createTask/createNote/archiveEngagement | HubSpot | CRM write | deny | yes, hubspot, before token/fetch |
| packages/integrations/src/hubspot/adapter.ts execute/rollback when client is HttpHubspotClient | HubSpot + Mira | live CRM execute | deny | yes, miraWrite then hubspot, before client call |
| packages/integrations/src/hubspot/provider.ts write | HubSpot | unimplemented write | deny | yes, hubspot, before body |
| packages/integrations/src/hubspot/client.ts FakeHubspotClient | none (fixture) | in-memory | fixture writes allowed | no (not live) |
| packages/integrations/src/salesforce/write.ts executeSalesforceWrite | Salesforce | no adapter existed; env placeholders only | deny | yes, salesforce, before any client |
| packages/agents/src/ledger/actionLedger.ts execute | Mira | CRM action execution | deny when adapter.isLiveOutbound() | yes, before executing status / adapters / fetch |
| apps/api/src/handlers.ts executeAction | Mira HTTP | execute | 409 LIVE_SURFACE_DENIED when live | maps gate error |
| apps/api/src/handlers.ts webhookHubspot | HubSpot | inbound local ingest only | ingest unchanged | outbound helper gated; handler does not construct write clients |
| packages/integrations/src/webhookOutbound.ts | HubSpot/etc | webhook vendor write-back | deny | yes, before fetch |
| apps/worker/src/jobs/crmSync.ts | HubSpot | inbound sync (reads) | reads not write-gated | outbound posts must use runOutboundWorkerPost |
| apps/worker/src/outbound.ts runOutboundWorkerPost | nested surface | worker outbound POST | deny | yes, before job body |
| packages/integrations/src/email/adapter.ts StubEmailAdapter | none | in-memory stub | stub only | no live provider; comment requires gate on a future live adapter |
| apps/api/src/frontdesk.ts executeSimulatedSend simulation=false | SMS | real send structurally refused | deny | sms flag consulted; still RealSendRefusedError (no provider) |
| .env.example HUBSPOT_* SALESFORCE_* EMAIL_PROVIDER_API_KEY SLACK_* | secrets | placeholders | empty | secrets are not consent |
| packages/workflows/n8n/proposal-notify.json | Slack notify | empty nodes | not wired | inventory only |
| packages/workflows/n8n/crm-sync-schedule.json | HubSpot sync trigger | empty nodes | not wired | inventory only |
| packages/integrations/src/hubspot/tokenProvider.ts refresh | HubSpot OAuth | token refresh network | not a CRM write | not gated (write paths never reach it when denied) |
| apps/api/src/server.ts HttpHubspotClient composition | HubSpot | client may be constructed when credential key present | writes still deny | method-level gate; construction does not fetch |

## Flags (committed defaults: all false)

- LIVE_OUTBOUND_EXPLICITLY_ALLOWED=false (master)
- LIVE_OUTBOUND_HUBSPOT=false
- LIVE_OUTBOUND_SALESFORCE=false
- LIVE_OUTBOUND_MIRA_WRITE=false
- LIVE_OUTBOUND_EMAIL=false
- LIVE_OUTBOUND_SMS=false

Both master AND the nested surface flag must be true. Anything else fail-closes
LIVE_SURFACE_DENIED, outbound=false.

## Out of scope (not touched)

skillucate, cognitia-cloud-website, empire-fragments, Syndesis, DealerOS,
haul-crm, Destiny Mapper. EP-18 G1 not implemented. README Live (v1) marketing
text not rewritten. No deploy. Flags not set true. .env not committed.
