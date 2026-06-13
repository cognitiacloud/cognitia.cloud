import type { Repository } from '@cognitia/db';
import type { SsoConfigStore, SsoProtocol, IdpProvider } from './sso.js';
import type { Role } from './auth.js';

/**
 * AUTH-2 — exportable access-review evidence.
 *
 * For a SOC 2 access review a reviewer needs two things per tenant: (1) the
 * access POLICY — which IdP is trusted and how its groups map to roles; and
 * (2) the observed ACCESS — who actually acted, how often, and when last. Both
 * are derived from existing state: the tenant SSO config (non-secret fields
 * only — the signing key is NEVER exported) and the immutable, hash-chained
 * audit trail (every governed action already attributes to a verified user).
 *
 * No new table, no migration: this is a read-model over the audit log + config.
 */

export interface AccessReviewUser {
  actor_ref: string;
  action_count: number;
  first_seen: string;
  last_seen: string;
  /** Distinct audit action verbs this actor performed (e.g. approved, executed). */
  actions: string[];
}

export interface AccessReviewSso {
  configured: boolean;
  protocol?: SsoProtocol;
  provider?: IdpProvider;
  issuer?: string;
  audience?: string;
  /** group/role → app Role. The signing key is intentionally absent. */
  role_mapping?: Record<string, Role>;
  default_role?: Role | null;
}

export interface AccessReview {
  generated_at: string;
  tenant_id: string;
  sso: AccessReviewSso;
  user_count: number;
  users: AccessReviewUser[];
}

export async function buildAccessReview(
  repo: Repository,
  tenantId: string,
  ssoStore: SsoConfigStore | undefined,
  opts: { now?: string } = {},
): Promise<AccessReview> {
  const now = opts.now ?? new Date().toISOString();
  const events = await repo.listAuditEvents(tenantId);

  const acc = new Map<
    string,
    { count: number; first: string; last: string; actions: Set<string> }
  >();
  for (const e of events) {
    const cur = acc.get(e.actor_ref);
    if (!cur) {
      acc.set(e.actor_ref, {
        count: 1,
        first: e.occurred_at,
        last: e.occurred_at,
        actions: new Set([e.action]),
      });
    } else {
      cur.count += 1;
      if (e.occurred_at < cur.first) cur.first = e.occurred_at;
      if (e.occurred_at > cur.last) cur.last = e.occurred_at;
      cur.actions.add(e.action);
    }
  }

  const users: AccessReviewUser[] = [...acc.entries()]
    .map(([actor_ref, v]) => ({
      actor_ref,
      action_count: v.count,
      first_seen: v.first,
      last_seen: v.last,
      actions: [...v.actions].sort(),
    }))
    .sort((a, b) => (a.last_seen < b.last_seen ? 1 : -1)); // most recent first

  const config = ssoStore ? await ssoStore.getByTenant(tenantId) : null;
  const sso: AccessReviewSso = config
    ? {
        configured: true,
        protocol: config.protocol,
        provider: config.provider,
        issuer: config.issuer,
        audience: config.audience,
        role_mapping: config.roleMapping,
        default_role: config.defaultRole,
        // NOTE: signingPublicKeyPem deliberately omitted from the export.
      }
    : { configured: false };

  return { generated_at: now, tenant_id: tenantId, sso, user_count: users.length, users };
}
