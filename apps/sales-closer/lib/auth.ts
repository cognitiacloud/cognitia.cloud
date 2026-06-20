import { env } from '@cognitia/config';

export interface AdminContext {
  actor: string;
  ip?: string;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Admin guard for state-changing routes. In MOCK_MODE the guard is permissive
 * so local dev and e2e work without auth wiring; otherwise it requires the
 * Supabase service-role key to be presented as a bearer token. Replace with a
 * real session check when wiring Supabase Auth.
 */
export function requireAdmin(req: Request): AdminContext {
  const ip = req.headers.get('x-forwarded-for') ?? undefined;
  if (env.MOCK_MODE) return { actor: 'mock-admin', ip };

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!env.SUPABASE_SERVICE_ROLE_KEY || token !== env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new UnauthorizedError();
  }
  return { actor: 'admin', ip };
}
