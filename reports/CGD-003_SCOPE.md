# CGD-003 SCOPE

Packet: remaining HubSpot HTTP quarantine (hermes hubspot-skill, HubspotProvider.connect
OAuth exchange, any other vendor fetch outside HttpHubspotClient).
Repo: cognitia.cloud. Branch: packet/cgd-003-hubspot-http-remainder.
Stacks on CGD-002 519d39c (packet/cgd-002-hubspot-read-quarantine).
This is an inventory + code-path quarantine on a packet branch. It is not a pentest
and not a production cutover. Live remains off.

Inspection (no vendor APIs called): hermes/skills/hubspot-skill, packages/integrations
(HubspotProvider.connect, HttpHubspotClient, tokenProvider, salesforce stubs),
packages/core liveOutbound, CGD-001/002 SCOPE reports. Select-String for hubspot.com,
api.hubapi.com, oauth, salesforce.com.

## Surfaces

| Path | Vendor | Kind | Default state (this branch) | Gated? |
| --- | --- | --- | --- | --- |
| hermes/skills/hubspot-skill/_request CRM GET/POST/PUT | HubSpot | skill live HTTP | deny | yes, hubspotSkill, before bearer token/urlopen |
| hermes/skills/hubspot-skill/OAuthAuth._refresh | HubSpot | skill OAuth refresh HTTP | deny | yes, hubspotSkill, before token HTTP |
| hermes/skills/hubspot-skill/_http_call urlopen | HubSpot | single network seam | deny | yes, hubspotSkill, before urlopen |
| hermes hubspot-skill health/lookup/associate/writeback live | HubSpot | skill tools | deny when creds present | yes, hubspotSkill; returns LIVE_SURFACE_DENIED, no vendor request |
| HubspotProvider.connect | HubSpot | OAuth authorization-code exchange stub | deny | yes, hubspotOAuthConnect, before unimplemented body |
| hermes hubspot-skill seam (no creds) / simulation | none | fixture/seam | allowed, no HTTP | no (no vendor fetch) |
| HttpHubspotClient GET/write | HubSpot | already CGD-001/002 | deny | unchanged |
| ConnectionTokenProvider.refresh | HubSpot | already CGD-002 | deny | unchanged |
| executeSalesforceWrite / executeSalesforceRead | Salesforce | stubs, no adapter | deny | unchanged (CGD-001/002) |
| seed-hubspot-credential.mjs | none | local Postgres seed | local DB only | n/a (no vendor HTTP) |
| HubSpot webhook ingest | none | local DB ingest | inbound local | n/a (not vendor GET) |

CGD-001 write gates and CGD-002 read/refresh gates unchanged.

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
- LIVE_OUTBOUND_HUBSPOT_OAUTH_CONNECT=false
- LIVE_OUTBOUND_HUBSPOT_SKILL=false

Both master AND the nested surface flag must be true. Anything else fail-closes
LIVE_SURFACE_DENIED, outbound=false, inboundVendor=false.

## Residual (honest)

No remaining ungated HubSpot vendor HTTP in this repo. Salesforce still has no
live adapter and no connect/OAuth-exchange class; there is no Salesforce HTTP
to gate beyond the existing stubs. A future SalesforceProvider.connect would
need a nested flag; it is not present today. Cached OAuth bearer (skill) and
valid ConnectionTokenProvider tokens remain local lookups (no vendor HTTP).

## Out of scope (not touched)

skillucate, cognitia-cloud-website, empire-fragments, Syndesis, DealerOS,
haul-crm, Destiny Mapper. EP-18 G1 not implemented. README Live (v1) marketing
text not rewritten. No deploy. Flags not set true. .env not committed.
