import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError } from './auth';

/** JSON success response. */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

/** JSON error response. */
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type RouteContext = { params: Promise<Record<string, string>> };

/** Wrap a route handler with consistent error -> HTTP mapping. */
export function route(
  handler: (req: Request, ctx: { params: Record<string, string> }) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: RouteContext) => {
    try {
      const params = ctx?.params ? await ctx.params : {};
      return await handler(req, { params });
    } catch (err) {
      if (err instanceof UnauthorizedError) return fail('Unauthorized', 401);
      if (err instanceof ZodError) return fail(err.issues.map((i) => i.message).join('; '), 422);
      const message = err instanceof Error ? err.message : 'Internal error';
      return fail(message, 500);
    }
  };
}
