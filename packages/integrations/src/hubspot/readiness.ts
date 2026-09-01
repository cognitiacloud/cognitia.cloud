import type { HubspotClient } from './client.js';
import { REQUIRED_ENGAGEMENT_PROPERTIES } from './writePlan.js';

/**
 * RDY-1 — connection readiness gate. Verifies a tenant's HubSpot portal is
 * correctly configured for governed CRM write-back BEFORE the first live
 * action, turning the manual go-live checklist (hubspot-onboarding.md §4) into
 * an automated, operator-visible check. The #1 documented go-live failure is a
 * write rejected because a required `cognitia_*` property doesn't exist in the
 * portal; this catches that ahead of time instead of at execution.
 *
 * Read-only: it lists property definitions, never writes.
 */

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ConnectionReadiness {
  ready: boolean;
  connection_status: string;
  checks: ReadinessCheck[];
  /** Required custom properties absent from each engagement object. */
  missing_properties: { tasks: string[]; notes: string[] };
}

export interface ReadinessInput {
  tenantId: string;
  /** Connection status from integration_connections (or 'not_connected'). */
  connectionStatus: string;
}

export async function checkHubspotReadiness(
  client: HubspotClient,
  input: ReadinessInput,
): Promise<ConnectionReadiness> {
  // CGD-002: do not throw at the report entry. Live property GETs are gated
  // inside HubspotClient.listObjectProperties (before token/fetch). A deny
  // is represented as failed property checks so operators still get a
  // not-ready report (connection_active, paused, not_connected).
  const checks: ReadinessCheck[] = [];

  // 1. Connection must be active (ENF-1 kill switch / onboarding state).
  const connectionActive = input.connectionStatus === 'active';
  checks.push({
    name: 'connection_active',
    ok: connectionActive,
    detail: connectionActive
      ? 'integration connection is active'
      : `connection status is "${input.connectionStatus}" (expected "active")`,
  });

  // 2. Required custom properties present on Tasks and Notes.
  const required = [...REQUIRED_ENGAGEMENT_PROPERTIES];
  const missing: { tasks: string[]; notes: string[] } = { tasks: [], notes: [] };
  for (const object of ['tasks', 'notes'] as const) {
    let present: Set<string>;
    try {
      present = new Set(await client.listObjectProperties({ tenantId: input.tenantId, object }));
    } catch (err) {
      // Can't read properties → treat as not ready, surface the reason.
      checks.push({
        name: `properties_${object}`,
        ok: false,
        detail: `could not read ${object} properties: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
      missing[object] = required;
      continue;
    }
    const absent = required.filter((p) => !present.has(p));
    missing[object] = absent;
    checks.push({
      name: `properties_${object}`,
      ok: absent.length === 0,
      detail:
        absent.length === 0
          ? `all ${required.length} required properties present on ${object}`
          : `missing on ${object}: ${absent.join(', ')}`,
    });
  }

  const ready = checks.every((c) => c.ok);
  return { ready, connection_status: input.connectionStatus, checks, missing_properties: missing };
}
