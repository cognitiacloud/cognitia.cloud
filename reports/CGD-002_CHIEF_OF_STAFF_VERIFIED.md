# CGD-002 CHIEF_OF_STAFF_VERIFIED

Honest status for Chief of Staff. Not a pentest. Not a production cutover.
Live is still off on this packet branch.

Done:
- Nested deny-by-default flags hubspotRead / hubspotOAuthRefresh / salesforceRead
  (plus existing CGD-001 write flags), all false in committed .env.example
- Gate at start of HubSpot GET list methods, live HubspotSyncService,
  worker crm-sync (live clients), HubSpot OAuth refresh, HubspotProvider
  sync/read stubs, Salesforce read stub — before client/fetch
- Fail-close LIVE_SURFACE_DENIED, outbound=false, inboundVendor=false
- Fixture/local clients with liveOutbound=false still sync without read flags
- Vitest 95 files / 643 tests passed with network stubbed on live vendor tests
- Flags not set true; .env not committed; no deploy; no production migrations

Not done / not claimed:
- No BETA / PILOT / PRODUCTION_CANDIDATE_PASS
- Salesforce still has no real adapter; only gated write (CGD-001) and read
  (CGD-002) entries so secrets cannot call vendor HTTP
- HubSpot webhook ingest remains local DB ingest (inbound); not a vendor GET
- ConnectionTokenProvider valid/cached token lookup remains local (no HTTP);
  expired-token refresh is gated
- Consented decision to turn live reads or writes on is not this packet
