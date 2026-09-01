# CGD-002 SCOPE

Packet: HubSpot (and Salesforce) read / sync / OAuth-refresh quarantine.
Repo: cognitia.cloud. Branch: packet/cgd-002-hubspot-read-quarantine.
Stacks on CGD-001 519f7aa (packet/cgd-001-live-surface-quarantine).
This is an inventory + code-path quarantine on a packet branch. It is not a pentest
and not a production cutover. Live remains off.

Inspection (no vendor APIs called): CGD-001 gate module, HttpHubspotClient reads,
OAuth refresh, worker crm-sync, packages/integrations, reports/CGD-001_SCOPE.md.

## Surfaces

| Path | Vendor | Kind | Default state (this branch) | Gated? |
| --- | --- | --- | --- | --- |
| packages/integrations/src/hubspot/httpClient.ts listCompanies/listContacts/listDeals/listObjectProperties | HubSpot | CRM GET | deny | yes, hubspotRead, before token/fetch |
| packages/integrations/src/hubspot/sync.ts HubspotSyncService.sync | HubSpot | inbound sync | deny when client.liveOutbound !== false | yes, hubspotRead, before paging |
| apps/worker/src/jobs/crmSync.ts | HubSpot | inbound sync job | deny when live client | yes, hubspotRead, before service/fetch/token |
| packages/integrations/src/hubspot/tokenProvider.ts ConnectionTokenProvider.refresh | HubSpot | OAuth refresh HTTP | deny | yes, hubspotOAuthRefresh, before fetch |
| packages/integrations/src/hubspot/provider.ts sync/read | HubSpot | unimplemented read/sync | deny | yes, hubspotRead, before body |
| packages/integrations/src/hubspot/readiness.ts checkHubspotReadiness | HubSpot | operator readiness report | report still returned | property GETs gated in HttpHubspotClient; deny becomes failed checks, no vendor request |
| packages/integrations/src/hubspot/client.ts FakeHubspotClient lists | none (fixture) | in-memory | fixture reads allowed | no (liveOutbound=false) |
| packages/integrations/src/salesforce/read.ts executeSalesforceRead | Salesforce | no adapter existed; env placeholders only | deny | yes, salesforceRead, before any client |
| ConnectionTokenProvider.getAccessToken valid/cached token | HubSpot | local secret lookup | allowed (no vendor HTTP) | refresh path only is gated |

CGD-001 write gates (hubspot / salesforce / miraWrite / webhook / worker POST) unchanged.

## Flags (committed defaults: all false)

- LIVE_OUTBOUND_EXPLICITLY_ALLOWED=false (master)
- LIVE_OUTBOUND_HUBSPOT=false
- LIVE_OUTBOUND_SALESFORCE=false
- LIVE_OUTBOUND_MIRA_WRITE=false
- LIVE_OUTBOUND_EMAIL=false
- LIVE_OUTBOUND_SMS=false
- LIVE_OUTBOUND_HUBSPOT_READ=false
- LIVE_OUTBOUND_HUBSPOT_OAUTH_REFRESH=false
- LIVE_OUTBOUND_SALESFORCE_READ=false

Both master AND the nested surface flag must be true. Anything else fail-closes
LIVE_SURFACE_DENIED, outbound=false, inboundVendor=false.

## Out of scope (not touched)

skillucate, cognitia-cloud-website, empire-fragments, Syndesis, DealerOS,
haul-crm, Destiny Mapper. EP-18 G1 not implemented. README Live (v1) marketing
text not rewritten. No deploy. Flags not set true. .env not committed.
Hermes hubspot-skill not changed.
