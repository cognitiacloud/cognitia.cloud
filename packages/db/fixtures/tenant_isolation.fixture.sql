-- Cross-cutting fixture: two tenants each with one account + contact, used by
-- the tenant-isolation integration test (Tenant A must not read Tenant B).

-- Tenant A = 1111..., Tenant B = 2222... (from 0001 fixture)
insert into accounts (id, tenant_id, name, domain, fit_score, timing_score) values
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Acme Target A', 'targeta.com', 0.9, 0.8),
  ('b1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Globex Target B', 'targetb.com', 0.7, 0.6);

insert into contacts (id, tenant_id, account_id, full_name, title, persona, email_hash, is_suppressed) values
  ('a2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a1000000-0000-0000-0000-000000000001', 'Ada A', 'VP Eng', 'champion', 'sha256:ada', false),
  ('a2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'a1000000-0000-0000-0000-000000000001', 'Sed Suppressed', 'CTO', 'economic_buyer', 'sha256:sed', true),
  ('b2000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'b1000000-0000-0000-0000-000000000001', 'Bob B', 'VP Sales', 'champion', 'sha256:bob', false);

-- Suppression: Tenant A has a suppressed contact (Sed) that Mira must never
-- propose an executable email to.
