import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, HttpError, type ApiRequest, type ApiResponse } from './handlers.js';

/**
 * Fastify binding. The MVP wires the in-memory repository so the server boots
 * without a database; swap in the Kysely-backed Repository (packages/db) for
 * production. Tenant is read from the `x-tenant-id` header.
 */
export function buildServer(handlers: ApiHandlers) {
  const app = Fastify({ logger: false });

  const headerStr = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v.join(',') : v;

  const toReq = (request: FastifyRequest): ApiRequest => ({
    tenantId: (request.headers['x-tenant-id'] as string | undefined) ?? undefined,
    params: request.params as Record<string, string>,
    query: request.query as Record<string, string | undefined>,
    body: request.body,
    traceId: (request.headers['x-trace-id'] as string | undefined) ?? randomUUID(),
  });

  /** Reconstruct the exact URI HubSpot signed: scheme + host + path + query. */
  const fullUri = (request: FastifyRequest): string => {
    const proto = headerStr(request.headers['x-forwarded-proto']) ?? request.protocol;
    const host =
      headerStr(request.headers['x-forwarded-host']) ?? headerStr(request.headers.host) ?? '';
    return `${proto}://${host}${request.url}`;
  };

  const toWebhookReq = (request: FastifyRequest): ApiRequest => {
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(request.headers)) headers[k] = headerStr(v);
    return {
      ...toReq(request),
      headers,
      method: request.method,
      fullUri: fullUri(request),
      // Captured by the route-scoped raw-body parser registered below.
      rawBody: (request as FastifyRequest & { rawBody?: string }).rawBody,
    };
  };

  const send = async (
    reply: FastifyReply,
    fn: (req: ApiRequest) => Promise<ApiResponse>,
    request: FastifyRequest,
    toApiReq: (r: FastifyRequest) => ApiRequest = toReq,
  ) => {
    try {
      const res = await fn(toApiReq(request));
      reply.code(res.status).send(res.body);
    } catch (err) {
      if (err instanceof HttpError) {
        reply.code(err.status).send({ error: err.message });
        return;
      }
      reply.code(500).send({ error: err instanceof Error ? err.message : 'error' });
    }
  };

  app.get('/health', (req, reply) => send(reply, () => handlers.health(), req));

  // Route-scoped raw-body capture: an encapsulated plugin registers its own JSON
  // content-type parser that retains the exact raw body for signature
  // verification. This does NOT affect other routes (which use the default
  // parser) because Fastify content-type parsers are encapsulated per-plugin.
  app.register(async (webhookScope) => {
    webhookScope.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (request, raw, done) => {
        (request as FastifyRequest & { rawBody?: string }).rawBody =
          typeof raw === 'string' ? raw : raw.toString('utf8');
        try {
          const parsed = (raw as string).length ? JSON.parse(raw as string) : {};
          done(null, parsed);
        } catch (e) {
          done(e as Error, undefined);
        }
      },
    );
    webhookScope.post('/webhooks/hubspot', (req, reply) =>
      send(reply, (r) => handlers.webhookHubspot(r), req, toWebhookReq),
    );
  });

  app.post('/webhooks/inbound-lead', (req, reply) =>
    send(reply, (r) => handlers.webhookInboundLead(r), req),
  );
  app.post('/jobs/crm-sync', (req, reply) => send(reply, (r) => handlers.crmSyncJob(r), req));
  app.get('/accounts', (req, reply) => send(reply, (r) => handlers.listAccounts(r), req));
  app.get('/accounts/:id/context', (req, reply) =>
    send(reply, (r) => handlers.getAccountContext(r), req),
  );
  app.get('/campaigns', (req, reply) => send(reply, (r) => handlers.listCampaigns(r), req));
  app.post('/campaigns', (req, reply) => send(reply, (r) => handlers.createCampaign(r), req));
  app.post('/agent-runs/mira', (req, reply) => send(reply, (r) => handlers.runMira(r), req));
  app.get('/agent-runs/:id', (req, reply) => send(reply, (r) => handlers.getAgentRun(r), req));
  app.get('/agent-actions', (req, reply) => send(reply, (r) => handlers.listAgentActions(r), req));
  app.post('/agent-actions/:id/approve', (req, reply) =>
    send(reply, (r) => handlers.approveAction(r), req),
  );
  app.post('/agent-actions/:id/reject', (req, reply) =>
    send(reply, (r) => handlers.rejectAction(r), req),
  );
  app.post('/agent-actions/:id/execute', (req, reply) =>
    send(reply, (r) => handlers.executeAction(r), req),
  );
  app.get('/metrics/outbound', (req, reply) =>
    send(reply, (r) => handlers.metricsOutbound(r), req),
  );

  return app;
}

/** Build handlers over a fresh in-memory repo + agent services. */
export function buildHandlers(): { handlers: ApiHandlers; repo: InMemoryRepository } {
  const repo = new InMemoryRepository();
  const services = createGtmServices({ repo });
  const handlers = new ApiHandlers(repo, services, {
    hubspotWebhookSecret: process.env.HUBSPOT_WEBHOOK_SECRET,
  });
  return { handlers, repo };
}

// Entry point when run directly.
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (isMain) {
  const { handlers } = buildHandlers();
  const app = buildServer(handlers);
  const port = Number(process.env.API_PORT ?? 3001);
  app.listen({ port, host: '0.0.0.0' }).then(() => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: 'info', message: 'api.listening', duration_ms: 0 }));
  });
}
