-- Fixture for 0001: two tenants, a user, memberships.
-- Deterministic UUIDs so tests can reference them directly.

insert into tenants (id, name, slug, settings) values
  ('11111111-1111-1111-1111-111111111111', 'Acme GTM', 'acme', '{"auto_approve_low_risk": false}'),
  ('22222222-2222-2222-2222-222222222222', 'Globex GTM', 'globex', '{}');

insert into users (id, email_hash, display_name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sha256:operator-acme', 'Acme Operator');

insert into roles (id, tenant_id, name, permissions) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'operator', '["approve","reject"]');

insert into memberships (id, tenant_id, user_id, role_id) values
  ('44444444-4444-4444-4444-444444444444',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '33333333-3333-3333-3333-333333333333');
