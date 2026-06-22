/**
 * Secrets / connector dark-mode policy (mock-safe, dependency-free).
 *
 * Dark mode is the default and only sanctioned posture in this build:
 *   - connectors carry NO production credentials (placeholders only);
 *   - every action is a dry run with `sent: false`;
 *   - turning a connector live requires explicit founder + legal approval AND
 *     mock-safe mode being disabled — which this codebase never does.
 *
 * The policy fails closed: ambiguous or missing posture is treated as a
 * violation, not as permission to proceed.
 */

export const CONNECTORS = ['hubspot', 'gmail', 'slack', 'apify', 'crm-generic'] as const;
export type Connector = (typeof CONNECTORS)[number];

export interface ConnectorPosture {
  readonly connector: Connector;
  /** Must be 'dark' in mock-safe mode. */
  readonly mode: 'dark' | 'live';
  /**
   * Credential reference. Must be a placeholder (e.g. "env:PLACEHOLDER" or
   * "mock://…"), never a real secret value. Real-looking secrets fail closed.
   */
  readonly credentialRef: string;
}

/** Heuristics for a credentialRef that smells like a real secret. */
const REAL_SECRET_RE = [
  /sk-[A-Za-z0-9]{16,}/, // openai-style
  /xox[baprs]-[A-Za-z0-9-]{10,}/, // slack token
  /AIza[0-9A-Za-z_-]{30,}/, // google api key
  /AKIA[0-9A-Z]{16}/, // aws access key id
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // pem
];

function looksLikeRealSecret(ref: string): boolean {
  return REAL_SECRET_RE.some((re) => re.test(ref));
}

function isPlaceholderRef(ref: string): boolean {
  return /^(env:|mock:\/\/|placeholder:|dark:)/.test(ref) && !looksLikeRealSecret(ref);
}

export interface PolicyResult {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

/**
 * Assert a connector posture is dark-mode compliant. Fail-closed:
 *   - mode must be 'dark' while mock-safe;
 *   - credentialRef must be a recognized placeholder and never a real secret.
 */
export function assertDarkMode(
  posture: ConnectorPosture,
  opts?: { mockSafe?: boolean },
): PolicyResult {
  const mockSafe = opts?.mockSafe ?? true;
  const violations: string[] = [];

  if (mockSafe && posture.mode !== 'dark') {
    violations.push(`connector_not_dark:${posture.connector}`);
  }
  if (looksLikeRealSecret(posture.credentialRef)) {
    violations.push(`real_secret_detected:${posture.connector}`);
  }
  if (!isPlaceholderRef(posture.credentialRef)) {
    violations.push(`credential_ref_not_placeholder:${posture.connector}`);
  }

  return { ok: violations.length === 0, violations };
}

/**
 * A dry-run action. The `sent` field is the literal `false` — the type system
 * forbids constructing a "sent" dry-run action. This is the contract every
 * vendor/CRM action object must satisfy in mock-safe mode.
 */
export interface DryRunAction {
  readonly connector: Connector;
  readonly intent: string;
  /** Always false. Encoded as a literal so a truthy `sent` is a type error. */
  readonly sent: false;
  /** Hashed/ref'd target — never raw PII. */
  readonly target_ref: string;
}

/** Build a dry-run action; `sent` is forced to false. */
export function dryRun(connector: Connector, intent: string, target_ref: string): DryRunAction {
  return { connector, intent, sent: false, target_ref };
}

/**
 * Runtime guard for action objects arriving from less-typed boundaries
 * (JSON, network). Rejects any action whose `sent` is not literally false while
 * mock-safe mode is on.
 */
export function assertDryRun(action: { sent: unknown }, opts?: { mockSafe?: boolean }): PolicyResult {
  const mockSafe = opts?.mockSafe ?? true;
  if (mockSafe && action.sent !== false) {
    return { ok: false, violations: ['action_sent_must_be_false_in_mock_safe'] };
  }
  return { ok: true, violations: [] };
}
