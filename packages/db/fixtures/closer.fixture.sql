-- Sales Closer fixture (Phase 1). Extends the acme tenant (1111…) and reuses
-- account a1000000-…-000000000001 from tenant_isolation.fixture.sql.
-- Deterministic UUIDs: c1 = source, agent run = c0, scrape run = c2, raw = c5,
-- profile = c3, brief = c4. Load AFTER 0001 + tenant_isolation fixtures.

-- A safe public website-crawl source for acme.
insert into closer_sources (id, tenant_id, label, apify_actor_id, input, source_risk, max_results, active) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Dealership website crawl', 'apify/website-content-crawler',
   '{"startUrls":[{"url":"https://targeta.com"}]}'::jsonb, 'safe_public_website_crawl', 50, true);

-- The pipeline run is an agent_run (agent = closer); the scrape run carries Apify metadata.
insert into agent_runs (id, tenant_id, agent, objective, status, trace_id) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'closer', 'Score and brief Acme Target A', 'completed', 'trace-closer-0001');

insert into closer_scrape_runs
  (id, tenant_id, agent_run_id, source_id, apify_run_id, dataset_id, source_risk, status, stage, rows_in, accounts_upserted, contacts_upserted) values
  ('c2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'c0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'mock-apify-run-0001', 'mock-dataset-0001', 'safe_public_website_crawl', 'succeeded', 'brief', 1, 1, 1);

insert into closer_raw_records
  (id, tenant_id, scrape_run_id, payload, normalized, dedupe_key, account_id) values
  ('c5000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'c2000000-0000-0000-0000-000000000001',
   '{"url":"https://targeta.com","title":"Acme Target A"}'::jsonb,
   '{"name":"Acme Target A","domain":"targeta.com"}'::jsonb,
   'targeta.com', 'a1000000-0000-0000-0000-000000000001');

-- 1:1 closer profile for the deduped account (latest score; history would be in events).
insert into closer_account_profiles
  (id, tenant_id, account_id, tier, score, dimensions, rationale, model, crm_vendor, monthly_lead_volume, rooftops, oem_brands, scored_at) values
  ('c3000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a1000000-0000-0000-0000-000000000001', 'B', 72,
   '{"fit":0.8,"intent":0.6,"timing":0.7,"reachability":0.65}'::jsonb,
   'Strong fit; moderate intent signals from website.', 'mock-score-model',
   'DealerSocket', 220, 3, '["Toyota","Honda"]'::jsonb, now());

-- A draft brief with evidence-tagged claims (one verified_fact with a ref, one unknown).
insert into closer_briefs
  (id, tenant_id, account_id, agent_run_id, model, content_md, structured, claims, status) values
  ('c4000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'mock-brief-model',
   '# Closer Brief: Acme Target A\n\nDealership with multi-rooftop footprint.',
   '{"pains":["Slow lead response"],"hooks":["Speed-to-lead"],"objections":["Already have a CRM"],"talk_track":["Open with response-time stats"],"recommended_offer":"14-day pilot"}'::jsonb,
   '[{"text":"Operates 3 rooftops","evidence_tag":"verified_fact","evidence_ref":"signal:c5000000-0000-0000-0000-000000000001"},{"text":"Likely evaluating new CRM this quarter","evidence_tag":"unknown"}]'::jsonb,
   'draft');
