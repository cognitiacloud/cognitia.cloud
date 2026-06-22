import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAccess,
  roleHasCapability,
  liveCapabilityIsDark,
  LIVE_CAPABILITIES,
  type AccessRequest,
} from './rbac.ts';

const T = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

function req(partial: Partial<AccessRequest> & Pick<AccessRequest, 'path'>): AccessRequest {
  return {
    principal: { tenant_id: T, role: 'operator' },
    resource_tenant_id: T,
    ...partial,
  };
}

test('allows a granted read route', () => {
  const d = evaluateAccess(req({ path: '/app/closer' }));
  assert.equal(d.allow, true);
});

test('denies cross-tenant access', () => {
  const d = evaluateAccess(req({ path: '/app/closer', resource_tenant_id: OTHER }));
  assert.deepEqual(d, { allow: false, reason: 'cross_tenant_denied' });
});

test('deny-by-default for unregistered routes', () => {
  const d = evaluateAccess(req({ path: '/app/secret-unlisted' }));
  assert.equal(d.allow, false);
  assert.equal(d.allow === false && d.reason, 'route_not_registered');
});

test('denies a capability the role lacks', () => {
  const d = evaluateAccess(req({ path: '/api/approvals/decide' })); // operator can't decide
  assert.equal(d.allow, false);
  assert.match((d as { reason: string }).reason, /missing_capability:approvals.decide/);
});

test('live capability is dark even for owner in mock-safe mode', () => {
  const d = evaluateAccess(
    req({ principal: { tenant_id: T, role: 'owner' }, path: '/api/actions/live' }),
  );
  assert.equal(d.allow, false);
  assert.match((d as { reason: string }).reason, /live_capability_dark/);
});

test('owner statically holds every capability but live caps stay dark', () => {
  for (const cap of LIVE_CAPABILITIES) {
    assert.equal(roleHasCapability('owner', cap), true);
    assert.equal(liveCapabilityIsDark(cap, true), true);
    assert.equal(liveCapabilityIsDark(cap, false), false);
  }
});
