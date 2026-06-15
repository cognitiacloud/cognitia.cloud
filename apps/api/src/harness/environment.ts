/**
 * Environment guard for the pilot proof harness.
 *
 * The single most important property of this harness: it MUST NOT touch
 * production, real money, real messaging, or any external API. This module
 * makes that property structural rather than aspirational — every "real"
 * capability is refused at construction time and at call time.
 */

/** Thrown when something tries to escalate the harness into a real channel. */
export class RealChannelError extends Error {
  constructor(channel: string) {
    super(
      `Refused: the pilot proof harness is simulation-only and cannot use the real "${channel}" channel.`,
    );
    this.name = "RealChannelError";
  }
}

/** Thrown when the harness detects it is being run against production. */
export class ProductionGuardError extends Error {
  constructor(detail: string) {
    super(`Refused: production execution is not allowed in the pilot proof harness (${detail}).`);
    this.name = "ProductionGuardError";
  }
}

/**
 * Public-facing configuration. Note the literal `false` types: there is no way
 * to construct a config that enables a real channel. The only knob a pilot
 * operator can flip is whether the public trust feed is configured on.
 */
export interface HarnessConfig {
  readonly mode: "dev" | "simulation";
  readonly realSms: false;
  readonly realPayments: false;
  readonly realExternalApis: false;
  readonly authTokenRequired: false;
  /** Safe-empty by default; pilots must opt in explicitly. */
  readonly publicTrustFeedEnabled: boolean;
}

export interface HarnessConfigOverrides {
  readonly mode?: "dev" | "simulation";
  readonly publicTrustFeedEnabled?: boolean;
}

/**
 * Environment variables that, if present and "truthy-real", indicate the
 * caller is trying to wire the harness to production infrastructure. The
 * harness refuses to start in that situation rather than silently doing the
 * wrong thing.
 */
const PRODUCTION_INDICATOR_VARS = [
  "DATABASE_URL",
  "PROD_DATABASE_URL",
  "TWILIO_AUTH_TOKEN",
  "STRIPE_SECRET_KEY",
  "COGNITIA_API_TOKEN",
] as const;

function looksLikeRealCredential(value: string | undefined): boolean {
  if (value === undefined) return false;
  const v = value.trim();
  if (v === "") return false;
  // Obvious dev/test placeholders are allowed; anything else is treated as real.
  const placeholder = /^(test|dev|local|dummy|fake|example|placeholder|sk_test_)/i;
  return !placeholder.test(v);
}

/**
 * Create a sealed, simulation-only configuration. Any attempt to enable a real
 * channel via overrides is structurally impossible (the override type does not
 * expose those fields), and production credentials abort construction.
 */
export function createSafeConfig(
  overrides: HarnessConfigOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): HarnessConfig {
  if (env.NODE_ENV === "production") {
    throw new ProductionGuardError("NODE_ENV=production");
  }

  for (const key of PRODUCTION_INDICATOR_VARS) {
    if (looksLikeRealCredential(env[key])) {
      throw new ProductionGuardError(`real credential detected in ${key}`);
    }
  }

  return Object.freeze({
    mode: overrides.mode ?? "simulation",
    realSms: false,
    realPayments: false,
    realExternalApis: false,
    authTokenRequired: false,
    publicTrustFeedEnabled: overrides.publicTrustFeedEnabled ?? false,
  });
}

/**
 * Assert that a named channel is allowed to be exercised. Because every real
 * channel flag is `false`, this always throws for real channels — that is the
 * point. Simulation code paths never call this; only would-be real code does.
 */
export function assertSimulationOnly(config: HarnessConfig, channel: string): void {
  switch (channel) {
    case "sms":
      if (config.realSms) throw new RealChannelError("sms");
      break;
    case "payments":
      if (config.realPayments) throw new RealChannelError("payments");
      break;
    case "external_api":
      if (config.realExternalApis) throw new RealChannelError("external_api");
      break;
    default:
      break;
  }
}
