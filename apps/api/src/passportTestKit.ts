import { randomUUID } from 'node:crypto';
import type { Repository } from '@cognitia/db';

/**
 * PASS-1 test kit. Execution now requires an active passport + live scope
 * grant with NO fallback to the bare agent name, so every test that executes
 * an action must perform the same step a live tenant owner performs at
 * onboarding: issue Mira's passport and approve its two governed CRM writes.
 * This mirrors the production flow (owner-approved, narrow, expiring) rather
 * than bypassing it.
 */
export async function grantMiraExecution(
  repo: Repository,
  tenantId: string,
  opts: {
    riskMax?: 'none' | 'low' | 'medium' | 'high';
    expiresAt?: string;
    /** Extra (actionType, integration) scopes beyond the two CRM writes. */
    extraScopes?: Array<{ actionType: string; integration: string }>;
  } = {},
): Promise<{ passportId: string; grantIds: string[] }> {
  const ts = new Date().toISOString();
  const passport = await repo.createAgentPassport({
    id: randomUUID(),
    tenant_id: tenantId,
    agent_id: 'mira',
    owner_ref: 'user:owner-test',
    status: 'active',
    key_ref: null,
    created_at: ts,
    updated_at: ts,
  });
  const grantIds: string[] = [];
  const scopes: Array<{ actionType: string; integration: string }> = [
    { actionType: 'crm.task.create', integration: 'hubspot' },
    { actionType: 'crm.note.create', integration: 'hubspot' },
    ...(opts.extraScopes ?? []),
  ];
  for (const { actionType, integration } of scopes) {
    const id = randomUUID();
    grantIds.push(id);
    await repo.createScopeGrant({
      id,
      tenant_id: tenantId,
      passport_id: passport.id,
      action_type: actionType,
      integration,
      risk_max: opts.riskMax ?? 'medium',
      status: 'active',
      approved_by: 'user:owner-test',
      approved_at: ts,
      expires_at: opts.expiresAt ?? '2099-01-01T00:00:00.000Z',
      revoked_at: null,
      revoked_by: null,
      created_at: ts,
      updated_at: ts,
    });
  }
  return { passportId: passport.id, grantIds };
}
