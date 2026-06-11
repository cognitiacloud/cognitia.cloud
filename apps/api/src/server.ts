import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { InMemoryRepository, type Repository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { log } from '@cognitia/core';
import type { HubspotClient } from '@cognitia/integrations';
import { ApiHandlers, HttpError, type ApiRequest, type ApiResponse } from './handlers.js';
import { HmacSessionVerifier, type SessionVerifier } from './auth.js';

/**
 * Fastify binding.
 *
 * Operator routes are authenticated by a verified session (`Authorization:
 * Bearer`) and the tenant is taken from the principal — `x-tenant-id` is NEVER
 * trusted on these routes. Webhook routes have their own auth (HMAC signature).
 */
export interface BuildServerOptions {
  /** Verifies operator session tokens. Absent ⇒ operator routes fail closed (401). */
  verifier?: SessionVerifier;
}

export function buildServer(handlers: ApiHandlers, opts: BuildServerOptions = {}) {
  const app = Fastify({ logger: false });
  const { verifier } = opts;

  const headerStr = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v.join(',') : v;

  /** Base request shape — NO tenant from headers (operator tenant comes from session). */
  const toReq = (request: FastifyRequest): ApiRequest => ({
    params: request.params as Record<string, string>,
    query: request.query as Record<string, string | undefined>,
    body: request.body,
    traceId: (request.headers['x-trace-id'] as string | undefined) ?? randomUUID(),
  });

  const fullUri = (request: FastifyRequest): string => {
    const proto = headerStr(request.headers['x-forwarded-proto']) ?? request.protocol;
    const host =
      headerStr(request.headers['x-forwarded-host']) ?? headerStr(request.headers.host) ?? '';
    return `${proto}://${host}${request.url}`;
  };

  /**
   * Webhook request shape. The HubSpot webhook is authenticated by HMAC signature
   * (not a session). Tenant resolution from the HubSpot portal id is a documented
   * follow-up; until then it reads `x-tenant-id` — acceptable ONLY because the
   * route is signature-gated (an attacker cannot call it without the secret).
   */
  const toWebhookReq = (request: FastifyRequest): ApiRequest => {
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(request.headers)) headers[k] = headerStr(v);
    return {
      ...toReq(request),
      tenantId: headerStr(request.headers['x-tenant-id']),
      headers,
      method: request.method,
      fullUri: fullUri(request),
      rawBody: (request as FastifyRequest & { rawBody?: string }).rawBody,
    };
  };

  const bearer = (request: FastifyRequest): string | undefined => {
    const h = headerStr(request.headers['authorization']);
    if (!h) return undefined;
    return h.startsWith('Bearer ') ? h.slice(7) : h;
  };

  const finish = (reply: FastifyReply, res: ApiResponse | Promise<ApiResponse>) =>
    Promise.resolve(res).then((r) => reply.code(r.status).send(r.body));

  const onError = (reply: FastifyReply, err: unknown) => {
    if (err instanceof HttpError) {
      reply.code(err.status).send({ error: err.message });
      return;
    }
    reply.code(500).send({ error: err instanceof Error ? err.message : 'error' });
  };

  /** Unauthenticated/own-auth routes (health, webhooks). */
  const send = async (
    reply: FastifyReply,
    fn: (req: ApiRequest) => Promise<ApiResponse>,
    request: FastifyRequest,
    toApiReq: (r: FastifyRequest) => ApiRequest = toReq,
  ) => {
    try {
      await finish(reply, fn(toApiReq(request)));
    } catch (err) {
      onError(reply, err);
    }
  };

  /** Operator routes: require a verified session; tenant + role from the principal. */
  const sendAuthed = async (
    reply: FastifyReply,
    fn: (req: ApiRequest) => Promise<ApiResponse>,
    request: FastifyRequest,
  ) => {
    if (!verifier) {
      reply.code(401).send({ error: 'authentication not configured' });
      return;
    }
    const principal = await verifier.verify(bearer(request));
    if (!principal) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    const req: ApiRequest = {
      ...toReq(request),
      tenantId: principal.tenantId,
      role: principal.role,
    };
    try {
      await finish(reply, fn(req));
    } catch (err) {
      onError(reply, err);
    }
  };

  // --- health (unauthenticated; reports DB connectivity) ---
  app.get('/health', (req, reply) => send(reply, () => handlers.health(), req));

  // --- webhooks (HMAC-signature auth; route-scoped raw-body capture) ---
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
    send(reply, (r) => handlers.webhookInboundLead(r), req, toWebhookReq),
  );
  app.post('/jobs/crm-sync', (req, reply) =>
    send(reply, (r) => handlers.crmSyncJob(r), req, toWebhookReq),
  );

  // --- operator routes (session-authenticated; tenant from principal) ---
  app.get('/accounts', (req, reply) => sendAuthed(reply, (r) => handlers.listAccounts(r), req));
  app.get('/accounts/:id/context', (req, reply) =>
    sendAuthed(reply, (r) => handlers.getAccountContext(r), req),
  );
  app.get('/campaigns', (req, reply) => sendAuthed(reply, (r) => handlers.listCampaigns(r), req));
  app.post('/campaigns', (req, reply) => sendAuthed(reply, (r) => handlers.createCampaign(r), req));
  app.get('/agent-runs', (req, reply) => sendAuthed(reply, (r) => handlers.listRunPlans(r), req));
  app.post('/agent-runs/mira', (req, reply) => sendAuthed(reply, (r) => handlers.runMira(r), req));
  app.post('/agent-runs/mira/preflight', (req, reply) =>
    sendAuthed(reply, (r) => handlers.preflightMira(r), req),
  );
  app.get('/agent-runs/:id', (req, reply) =>
    sendAuthed(reply, (r) => handlers.getAgentRun(r), req),
  );
  app.get('/agent-actions', (req, reply) =>
    sendAuthed(reply, (r) => handlers.listAgentActions(r), req),
  );
  app.post('/agent-actions/:id/approve', (req, reply) =>
    sendAuthed(reply, (r) => handlers.approveAction(r), req),
  );
  app.post('/agent-actions/:id/reject', (req, reply) =>
    sendAuthed(reply, (r) => handlers.rejectAction(r), req),
  );
  app.post('/agent-actions/batch-approve', (req, reply) =>
    sendAuthed(reply, (r) => handlers.batchApprove(r), req),
  );
  app.post('/agent-actions/batch-reject', (req, reply) =>
    sendAuthed(reply, (r) => handlers.batchReject(r), req),
  );
  app.post('/agent-actions/:id/execute', (req, reply) =>
    sendAuthed(reply, (r) => handlers.executeAction(r), req),
  );
  app.post('/agent-actions/:id/rollback', (req, reply) =>
    sendAuthed(reply, (r) => handlers.rollbackAction(r), req),
  );
  app.get('/agent-actions/:id/preview', (req, reply) =>
    sendAuthed(reply, (r) => handlers.previewAction(r), req),
  );
  app.get('/agent-actions/:id/rationale', (req, reply) =>
    sendAuthed(reply, (r) => handlers.actionRationale(r), req),
  );
  app.get('/agent-actions/:id/regression-candidate', (req, reply) =>
    sendAuthed(reply, (r) => handlers.regressionCandidate(r), req),
  );
  app.get('/agent-actions/:id/decisions', (req, reply) =>
    sendAuthed(reply, (r) => handlers.listActionDecisions(r), req),
  );
  app.get('/decisions', (req, reply) =>
    sendAuthed(reply, (r) => handlers.listActionDecisions(r), req),
  );
  app.get('/metrics/outbound', (req, reply) =>
    sendAuthed(reply, (r) => handlers.metricsOutbound(r), req),
  );
  app.get('/metrics/trust', (req, reply) =>
    sendAuthed(reply, (r) => handlers.metricsTrust(r), req),
  );
  app.get('/metrics/scorecards', (req, reply) =>
    sendAuthed(reply, (r) => handlers.metricsScorecards(r), req),
  );
  app.get('/reports/trust-packet', (req, reply) =>
    sendAuthed(reply, (r) => handlers.trustPacket(r), req),
  );
  app.get('/integrations/status', (req, reply) =>
    sendAuthed(reply, (r) => handlers.integrationStatus(r), req),
  );
  app.get('/integrations/readiness', (req, reply) =>
    sendAuthed(reply, (r) => handlers.integrationReadiness(r), req),
  );
  app.post('/integrations/:system/pause', (req, reply) =>
    sendAuthed(reply, (r) => handlers.pauseIntegration(r), req),
  );
  app.post('/integrations/:system/resume', (req, reply) =>
    sendAuthed(reply, (r) => handlers.resumeIntegration(r), req),
  );
  app.get('/governance', (req, reply) => sendAuthed(reply, (r) => handlers.governance(r), req));
  app.get('/audit', (req, reply) => sendAuthed(reply, (r) => handlers.auditTrail(r), req));

  // --- COG-003: Proof Registry (operator routes; append-only, no delete route) ---
  app.get('/proofs', (req, reply) => sendAuthed(reply, (r) => handlers.listProofs(r), req));
  app.get('/proofs/public', (req, reply) =>
    sendAuthed(reply, (r) => handlers.listPublicProofs(r), req),
  );
  app.post('/proofs', (req, reply) => sendAuthed(reply, (r) => handlers.createProof(r), req));
  app.post('/proofs/:id/supersede', (req, reply) =>
    sendAuthed(reply, (r) => handlers.supersedeProof(r), req),
  );
  app.post('/proofs/:id/redaction-check', (req, reply) =>
    sendAuthed(reply, (r) => handlers.proofRedactionCheck(r), req),
  );

  // --- COG-004: agents + ATC lifecycle + permissions (no delete routes) ---
  app.get('/agents', (req, reply) => sendAuthed(reply, (r) => handlers.listAgentsWithAtc(r), req));
  app.post('/agents', (req, reply) => sendAuthed(reply, (r) => handlers.registerAgent(r), req));
  app.get('/agents/:id', (req, reply) => sendAuthed(reply, (r) => handlers.getAgentDetail(r), req));
  app.post('/agents/:id/atc', (req, reply) => sendAuthed(reply, (r) => handlers.issueAtc(r), req));
  app.get('/agents/:id/permissions', (req, reply) =>
    sendAuthed(reply, (r) => handlers.listAgentPermissions(r), req),
  );
  app.put('/agents/:id/permissions', (req, reply) =>
    sendAuthed(reply, (r) => handlers.putAgentPermissions(r), req),
  );
  app.post('/atc/:id/suspend', (req, reply) =>
    sendAuthed(reply, (r) => handlers.atcTransition(r, 'suspend'), req),
  );
  app.post('/atc/:id/resume', (req, reply) =>
    sendAuthed(reply, (r) => handlers.atcTransition(r, 'resume'), req),
  );
  app.post('/atc/:id/expire', (req, reply) =>
    sendAuthed(reply, (r) => handlers.atcTransition(r, 'expire'), req),
  );
  app.post('/atc/:id/revoke', (req, reply) =>
    sendAuthed(reply, (r) => handlers.atcTransition(r, 'revoke'), req),
  );

  // --- COG-006: MoverOS AI Front Desk (simulation-first; approval reuses
  // the existing /agent-actions/:id/approve|reject endpoints) ---
  app.get('/leads', (req, reply) => sendAuthed(reply, (r) => handlers.listLeads(r), req));
  app.post('/leads', (req, reply) => sendAuthed(reply, (r) => handlers.ingestLead(r), req));
  app.get('/leads/:id', (req, reply) => sendAuthed(reply, (r) => handlers.getLeadDetail(r), req));
  app.post('/leads/:id/draft', (req, reply) =>
    sendAuthed(reply, (r) => handlers.draftLeadReply(r), req),
  );
  app.post('/leads/:id/purge-pii', (req, reply) =>
    sendAuthed(reply, (r) => handlers.purgeLeadPii(r), req),
  );
  app.post('/front-desk/actions/:id/execute', (req, reply) =>
    sendAuthed(reply, (r) => handlers.executeFrontDeskAction(r), req),
  );
  app.post('/leads/:id/actions', (req, reply) =>
    sendAuthed(reply, (r) => handlers.proposeLeadAction(r), req),
  );
  app.post('/leads/:id/outcomes', (req, reply) =>
    sendAuthed(reply, (r) => handlers.createLeadOutcome(r), req),
  );
  app.get('/front-desk/summary', (req, reply) =>
    sendAuthed(reply, (r) => handlers.leadRescueSummary(r), req),
  );

  // --- COG-008: Reputation v0 (read + recompute; NO event-post route) ---
  app.get('/agents/:id/reputation', (req, reply) =>
    sendAuthed(reply, (r) => handlers.getAgentReputation(r), req),
  );
  app.post('/agents/:id/reputation/recompute', (req, reply) =>
    sendAuthed(reply, (r) => handlers.recomputeReputation(r), req),
  );

  // --- COG-009: internal credits + wallet placeholders (no payment rails) ---
  app.get('/credits/accounts', (req, reply) =>
    sendAuthed(reply, (r) => handlers.listCreditsAccounts(r), req),
  );
  app.post('/credits/accounts', (req, reply) =>
    sendAuthed(reply, (r) => handlers.openCreditsAccount(r), req),
  );
  app.get('/credits/accounts/:id', (req, reply) =>
    sendAuthed(reply, (r) => handlers.getCreditsAccount(r), req),
  );
  app.get('/credits/accounts/:id/ledger', (req, reply) =>
    sendAuthed(reply, (r) => handlers.getCreditsLedger(r), req),
  );
  app.post('/credits/transfer', (req, reply) =>
    sendAuthed(reply, (r) => handlers.transferCredits(r), req),
  );
  app.get('/wallet-bindings', (req, reply) =>
    sendAuthed(reply, (r) => handlers.listWalletBindings(r), req),
  );
  app.post('/wallet-bindings', (req, reply) =>
    sendAuthed(reply, (r) => handlers.createWalletBinding(r), req),
  );
  app.get('/wallet-bindings/:id', (req, reply) =>
    sendAuthed(reply, (r) => handlers.getWalletBinding(r), req),
  );
  app.post('/wallet-bindings/:id/deactivate', (req, reply) =>
    sendAuthed(reply, (r) => handlers.deactivateWalletBinding(r), req),
  );
  app.get('/crypto-readiness', (req, reply) =>
    sendAuthed(reply, (r) => handlers.cryptoReadiness(r), req),
  );

  // --- COG-005: SkillProof (internal-only; no marketplace routes exist) ---
  app.get('/skills', (req, reply) => sendAuthed(reply, (r) => handlers.listSkills(r), req));
  app.post('/skills/import-core', (req, reply) =>
    sendAuthed(reply, (r) => handlers.importCoreSkills(r), req),
  );
  app.get('/skills/:id', (req, reply) => sendAuthed(reply, (r) => handlers.getSkillDetail(r), req));
  app.get('/skills/:id/versions', (req, reply) =>
    sendAuthed(reply, (r) => handlers.listSkillVersions(r), req),
  );
  app.post('/skill-versions/:id/proofs', (req, reply) =>
    sendAuthed(reply, (r) => handlers.createSkillProof(r), req),
  );
  app.post('/skill-versions/:id/tier', (req, reply) =>
    sendAuthed(reply, (r) => handlers.upgradeSkillVersionTier(r), req),
  );
  app.post('/skill-versions/:id/yank', (req, reply) =>
    sendAuthed(reply, (r) => handlers.yankSkillVersion(r), req),
  );

  return app;
}

/** Build handlers over a fresh in-memory repo + agent services (tests/dev). */
export function buildHandlers(): { handlers: ApiHandlers; repo: InMemoryRepository } {
  const repo = new InMemoryRepository();
  const services = createGtmServices({ repo, v1Mode: true });
  const handlers = new ApiHandlers(repo, services, {
    hubspotWebhookSecret: process.env.HUBSPOT_WEBHOOK_SECRET,
  });
  return { handlers, repo };
}

/**
 * Production composition: Kysely-backed repo when `DATABASE_URL` is set (with a
 * real DB health probe), else in-memory. `pg` is lazy-imported by the factory.
 */
export async function buildHandlersFromEnv(): Promise<{
  handlers: ApiHandlers;
  close: () => Promise<void>;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  let repo: Repository;
  let healthCheck: () => Promise<boolean>;
  let close: () => Promise<void> = async () => {};
  // Persistent ciphertext backing for the SecretStore (credential_ciphertexts).
  let ciphertextBacking:
    | { get(ref: string): Promise<string | null>; set(ref: string, ct: string): Promise<void> }
    | undefined;

  if (databaseUrl) {
    const { createPostgresRepository, CredentialCiphertextStore } = await import('@cognitia/db');
    const pg = await createPostgresRepository(databaseUrl);
    repo = pg.repo;
    healthCheck = pg.ping;
    close = pg.close;
    ciphertextBacking = new CredentialCiphertextStore(pg.db);
  } else {
    repo = new InMemoryRepository();
    healthCheck = async () => true;
  }

  // CRM-1: wire the REAL HubSpot client when the deployment provides the AES key
  // (32-byte, base64) that decrypts per-tenant credentials. Without it, fall back
  // to the in-memory fake and warn — production go-live MUST set it (see B-3).
  let hubspotClient: HubspotClient | undefined;
  const credentialKeyB64 = process.env.CREDENTIAL_SECRET_KEY_BASE64;
  if (credentialKeyB64) {
    const { AesGcmSecretStore, ConnectionTokenProvider, HttpHubspotClient } =
      await import('@cognitia/integrations');
    const key = Buffer.from(credentialKeyB64, 'base64');
    // DB-backed ciphertext store so seeded credentials persist across restarts;
    // in-memory only when running without a database (dev).
    const secrets = new AesGcmSecretStore(key, ciphertextBacking);
    const tokenProvider = new ConnectionTokenProvider({ repo, secrets });
    hubspotClient = new HttpHubspotClient({ token: tokenProvider });
  } else if (databaseUrl) {
    log({
      level: 'warn',
      message: 'crm.hubspot.client_unconfigured', // CREDENTIAL_SECRET_KEY_BASE64 missing — fake client
    });
  }

  const services = createGtmServices({ repo, v1Mode: true, hubspotClient });
  const handlers = new ApiHandlers(repo, services, {
    hubspotWebhookSecret: process.env.HUBSPOT_WEBHOOK_SECRET,
    healthCheck,
    // RDY-1: same real client powers the read-only readiness gate.
    hubspotClient,
  });
  return { handlers, close };
}

// Entry point when run directly.
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (isMain) {
  const sessionSecret = process.env.SESSION_SECRET;
  // Fail closed: without a session secret, operator routes reject all requests.
  const verifier = sessionSecret ? new HmacSessionVerifier(sessionSecret) : undefined;
  buildHandlersFromEnv().then(({ handlers }) => {
    const app = buildServer(handlers, { verifier });
    const port = Number(process.env.API_PORT ?? 3001);
    return app.listen({ port, host: '0.0.0.0' }).then(() => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ level: 'info', message: 'api.listening', duration_ms: 0 }));
    });
  });
}
