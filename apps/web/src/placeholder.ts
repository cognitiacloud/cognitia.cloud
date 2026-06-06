/**
 * Web app placeholder. The Next.js operator console (approval queue, account
 * context, dashboards) is intentionally deferred — see docs/architecture.md.
 * The approval queue is fully available via the API today:
 *   GET  /agent-actions?status=proposed
 *   POST /agent-actions/:id/approve | reject | execute
 */
export const WEB_APP_STATUS = 'deferred' as const;
