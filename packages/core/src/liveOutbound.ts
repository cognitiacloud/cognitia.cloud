/**
 * CGD-001/CGD-002 - live/outbound + inbound-vendor surface quarantine.
 *
 * Secrets in env (HUBSPOT_*, SALESFORCE_*, EMAIL_*) MUST NOT write CRM, read
 * vendor CRM, refresh OAuth, send outreach, or execute Mira side effects. A
 * consented master flag plus the matching nested per-surface flag are both
 * required. Anything else is fail-close: LIVE_SURFACE_DENIED, outbound=false,
 * inboundVendor=false. Default in committed files is false. This is code-path
 * quarantine, not a production cutover.
 */

export const LIVE_SURFACE_DENIED = 'LIVE_SURFACE_DENIED' as const;

export type LiveSurface =
  | 'hubspot'
  | 'salesforce'
  | 'miraWrite'
  | 'email'
  | 'sms'
  | 'hubspotRead'
  | 'hubspotOAuthRefresh'
  | 'salesforceRead';

export const LIVE_OUTBOUND_ENV = {
  master: 'LIVE_OUTBOUND_EXPLICITLY_ALLOWED',
  hubspot: 'LIVE_OUTBOUND_HUBSPOT',
  salesforce: 'LIVE_OUTBOUND_SALESFORCE',
  miraWrite: 'LIVE_OUTBOUND_MIRA_WRITE',
  email: 'LIVE_OUTBOUND_EMAIL',
  sms: 'LIVE_OUTBOUND_SMS',
  hubspotRead: 'LIVE_OUTBOUND_HUBSPOT_READ',
  hubspotOAuthRefresh: 'LIVE_OUTBOUND_HUBSPOT_OAUTH_REFRESH',
  salesforceRead: 'LIVE_OUTBOUND_SALESFORCE_READ',
} as const;

export interface LiveOutboundFlags {
  LIVE_OUTBOUND_EXPLICITLY_ALLOWED: boolean;
  surfaces: Record<LiveSurface, boolean>;
}

/** Only the exact string "true" (case-insensitive, trimmed) is allowed. Fail-close. */
export function envFlagTrue(value: string | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === 'true';
}

export function readLiveOutboundFlags(env: NodeJS.ProcessEnv = process.env): LiveOutboundFlags {
  return {
    LIVE_OUTBOUND_EXPLICITLY_ALLOWED: envFlagTrue(env[LIVE_OUTBOUND_ENV.master]),
    surfaces: {
      hubspot: envFlagTrue(env[LIVE_OUTBOUND_ENV.hubspot]),
      salesforce: envFlagTrue(env[LIVE_OUTBOUND_ENV.salesforce]),
      miraWrite: envFlagTrue(env[LIVE_OUTBOUND_ENV.miraWrite]),
      email: envFlagTrue(env[LIVE_OUTBOUND_ENV.email]),
      sms: envFlagTrue(env[LIVE_OUTBOUND_ENV.sms]),
      hubspotRead: envFlagTrue(env[LIVE_OUTBOUND_ENV.hubspotRead]),
      hubspotOAuthRefresh: envFlagTrue(env[LIVE_OUTBOUND_ENV.hubspotOAuthRefresh]),
      salesforceRead: envFlagTrue(env[LIVE_OUTBOUND_ENV.salesforceRead]),
    },
  };
}

export function isLiveOutboundAllowed(
  surface: LiveSurface,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flags = readLiveOutboundFlags(env);
  return flags.LIVE_OUTBOUND_EXPLICITLY_ALLOWED && flags.surfaces[surface];
}

export class LiveSurfaceDeniedError extends Error {
  readonly code = LIVE_SURFACE_DENIED;
  readonly outbound = false as const;
  readonly inboundVendor = false as const;
  constructor(readonly surface: LiveSurface) {
    super(
      `${LIVE_SURFACE_DENIED}: ${surface} outbound blocked (deny-by-default; secrets are not consent)`,
    );
    this.name = 'LiveSurfaceDeniedError';
  }
}

export function isLiveSurfaceDenied(err: unknown): err is LiveSurfaceDeniedError {
  return err instanceof LiveSurfaceDeniedError;
}

/**
 * Fail-close gate. Call at the START of a live/outbound or inbound-vendor path,
 * BEFORE constructing a vendor client or calling fetch.
 */
export function assertLiveOutboundAllowed(
  surface: LiveSurface,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isLiveOutboundAllowed(surface, env)) {
    throw new LiveSurfaceDeniedError(surface);
  }
}

/** Fail-close: only an explicit liveOutbound=false is a fixture/local client. */
export function isLiveVendorClient(liveOutbound: boolean | undefined): boolean {
  return liveOutbound !== false;
}
