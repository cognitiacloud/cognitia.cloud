/**
 * Secret resolution seam (AUDIT alpha-blocker #2).
 *
 * Centralizes every sensitive-secret read behind a `SecretSource` so the
 * backend can be swapped (env in dev; KMS / Vault / cloud secret manager in
 * production) WITHOUT touching call sites. It also validates secret material at
 * boot — wrong-size keys and weak session secrets fail closed rather than
 * silently weakening auth or encryption.
 *
 * The default source reads process.env. A production deployment injects a
 * KMS/Vault-backed source implementing the same interface; this module is the
 * single place that knows how a secret is fetched.
 */

export class SecretConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretConfigError';
  }
}

export interface SecretSource {
  get(name: string): string | undefined;
}

/** Default source: process environment. Replace in prod with a KMS/Vault source. */
export const envSecretSource: SecretSource = {
  get: (name) => process.env[name],
};

/** True when the deployment declares itself production (fail-closed mode). */
export function isProductionDeploy(src: SecretSource = envSecretSource): boolean {
  return (src.get('DEPLOY_ENV') ?? src.get('NODE_ENV')) === 'production';
}

/**
 * Require a secret string, optionally enforcing a minimum length (entropy
 * floor). Throws SecretConfigError when missing or too short.
 */
export function requireSecret(
  name: string,
  opts: { minLength?: number; source?: SecretSource } = {},
): string {
  const source = opts.source ?? envSecretSource;
  const value = source.get(name);
  if (!value) throw new SecretConfigError(`${name} is required but not set`);
  if (opts.minLength && value.length < opts.minLength) {
    throw new SecretConfigError(
      `${name} is too short (${value.length} chars; require >= ${opts.minLength})`,
    );
  }
  return value;
}

/**
 * Require a base64 secret that decodes to exactly `bytes` bytes (e.g. a 32-byte
 * AES-256 key). Throws SecretConfigError on missing / wrong size / bad base64.
 */
export function requireKeyBytes(
  name: string,
  bytes: number,
  source: SecretSource = envSecretSource,
): Buffer {
  const raw = source.get(name);
  if (!raw) throw new SecretConfigError(`${name} is required but not set`);
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new SecretConfigError(`${name} is not valid base64`);
  }
  if (key.length !== bytes) {
    throw new SecretConfigError(
      `${name} must decode to exactly ${bytes} bytes (got ${key.length})`,
    );
  }
  return key;
}
