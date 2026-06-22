import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as closerModule from './index.js';
import { createMockCloserPorts } from './mockPorts.js';
import { createSalesCloserWorkflow } from './salesCloserWorkflow.js';
import { FIXTURE_LEAD } from './__fixtures__/lead.fixture.js';

/**
 * Mock/live boundary guards for the Sales Closer mock spine.
 *
 * The spine is a deliberately offline, mock-safe state machine: no live
 * outreach, no network, no DB, no autonomous send, no raw PII, and a CRM
 * writeback that is always a mock. These tests prove — both statically (by
 * scanning the runtime source) and behaviourally (by running the workflow) —
 * that no live outreach or writeback can happen from this package.
 *
 * Doctrine and the full list of prohibitions live in
 * `docs/sales-closer/mock-safety.md`. This file is the executable enforcement.
 *
 * Note: this is a `*.test.ts` file, so it is excluded from the whole-directory
 * containment scan in `packages/core/src/closer.guard.test.ts` and from the
 * doctrine scan in `salesCloserWorkflow.test.ts`. That is why it can safely
 * spell out the forbidden tokens below without flagging itself.
 */

const here = dirname(fileURLToPath(import.meta.url));
const closerDir = here;

/** Recursively collect production runtime files (excludes tests/fixtures/fakes). */
function runtimeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (/(^|\/)(__fixtures__|__mocks__|node_modules)$/.test(full)) continue;
      runtimeFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) continue;
    if (/\.test\.|\.spec\.|__fixtures__|fake/i.test(entry)) continue;
    out.push(full);
  }
  return out;
}

function fixtureFiles(dir: string): string[] {
  const fixturesDir = join(dir, '__fixtures__');
  try {
    return readdirSync(fixturesDir)
      .filter((f) => /\.(ts|tsx|js|mjs|cjs|json)$/.test(f))
      .map((f) => join(fixturesDir, f));
  } catch {
    return [];
  }
}

const RUNTIME = runtimeFiles(closerDir);
const FIXTURES = fixtureFiles(closerDir);
const rel = (f: string) => relative(closerDir, f);

const FIXED_ID = '11111111-1111-1111-1111-111111111110';
const FIXED_NOW = new Date('2026-06-21T00:00:00.000Z');

function deterministicWorkflowOpts(ports = createMockCloserPorts()) {
  let counter = 0;
  return {
    ports,
    now: () => FIXED_NOW,
    newId: () => `${FIXED_ID.slice(0, -1)}${counter++}`,
  };
}

describe('mock-safety: the spine has the expected runtime surface', () => {
  it('found the production runtime files to scan', () => {
    // Guard against a silently-empty scan (e.g. a rename that hides everything).
    expect(RUNTIME.length).toBeGreaterThanOrEqual(4);
    const names = RUNTIME.map(rel).sort();
    expect(names).toContain('index.ts');
    expect(names).toContain('ports.ts');
    expect(names).toContain('mockPorts.ts');
    expect(names).toContain('salesCloserWorkflow.ts');
  });
});

describe('mock-safety: no fetch / network / client SDKs in closer runtime', () => {
  // Import-shaped / API-shaped tokens for live IO and vendor SDKs. None of these
  // legitimately appear in an offline mock spine. (The bare word "network"
  // appears in prose comments and is intentionally NOT matched.)
  const FORBIDDEN_RUNTIME = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
    /\bnode:net\b/,
    /\bnode:http\b/,
    /\bnode:https\b/,
    /\bnode:dgram\b/,
    /\bnode:tls\b/,
    /\bchild_process\b/,
    /\baxios\b/,
    /\bgot\s*\(/,
    /\bundici\b/,
    /\bnode-fetch\b/,
    /\bApifyClient\b/,
    /\bnew\s+Anthropic\b/,
    /\bnew\s+OpenAI\b/,
    /\bgoogleapis\b/,
    /\btwilio\b/,
    /\bnodemailer\b/,
    /@sendgrid\b/,
    /\bnew\s+Stripe\b/,
    /@hubspot\b/,
    /\bsalesforce\b/i,
    /\bpipedrive\b/i,
  ];

  it('no runtime file makes a network call or imports a live client SDK', () => {
    const offenders: string[] = [];
    for (const file of RUNTIME) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_RUNTIME) {
        if (pattern.test(src)) offenders.push(`${rel(file)} :: ${pattern}`);
      }
    }
    expect(offenders, 'closer runtime must be offline and vendor-free').toEqual([]);
  });

  it('no runtime file imports the DB or integrations packages', () => {
    const offenders: string[] = [];
    for (const file of RUNTIME) {
      const src = readFileSync(file, 'utf8');
      if (src.includes('@cognitia/db')) offenders.push(`${rel(file)} imports @cognitia/db`);
      if (src.includes('@cognitia/integrations'))
        offenders.push(`${rel(file)} imports @cognitia/integrations`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('mock-safety: no raw PII fixtures', () => {
  it('found the fixture(s) to scan', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(1);
  });

  it('no fixture contains a raw contact field, email, or phone number', () => {
    const bannedIdentifier = /\b(contactEmail|contactPhone|emailAddress|phoneNumber|fullName)\b/;
    const emailShaped = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    const phoneShaped = /(?:\+?\d[\s().-]?){7,}\d/;
    const offenders: string[] = [];
    for (const file of FIXTURES) {
      const src = readFileSync(file, 'utf8');
      if (bannedIdentifier.test(src)) offenders.push(`${rel(file)} declares a raw contact field`);
      if (emailShaped.test(src)) offenders.push(`${rel(file)} contains an email-shaped literal`);
      if (phoneShaped.test(src)) offenders.push(`${rel(file)} contains a phone-shaped literal`);
    }
    expect(offenders, 'fixtures must be business-only, no raw PII').toEqual([]);
  });

  it('runtime types expose no raw contact fields', () => {
    const bannedIdentifier = /\b(contactEmail|contactPhone|emailAddress|phoneNumber|fullName)\b/;
    const offenders = RUNTIME.filter((f) => bannedIdentifier.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('mock-safety: no send / dial / post / publish action is exposed', () => {
  // A forbidden outbound verb used as a *declared callable* (method, property,
  // function, or const). The same words appear in prose ("no autonomous send
  // path", "outreach") — those are followed by whitespace, never `(` or `:`, so
  // they do not match.
  const FORBIDDEN_CALLABLE =
    /\b(send|dial|post|publish|deliver|transmit|broadcast)[A-Za-z0-9_]*\s*[(:=]/;

  it('no runtime file declares an outbound send/dial/post/publish callable', () => {
    const offenders: string[] = [];
    for (const file of RUNTIME) {
      const src = readFileSync(file, 'utf8');
      const match = src.match(FORBIDDEN_CALLABLE);
      if (match) offenders.push(`${rel(file)} :: ${match[0]}`);
    }
    expect(offenders, 'the spine exposes no outbound action verb').toEqual([]);
  });

  it('the public module exports no outbound action function', () => {
    const FORBIDDEN_EXPORT = /^(send|dial|post|publish|deliver|transmit|broadcast)/i;
    const offenders = Object.keys(closerModule).filter((name) => FORBIDDEN_EXPORT.test(name));
    expect(offenders, 'no exported symbol is an outbound action').toEqual([]);
  });

  it('the port surface is exactly the five non-sending boundaries', () => {
    const ports = createMockCloserPorts();
    expect(Object.keys(ports).sort()).toEqual([
      'appointment',
      'approval',
      'compliance',
      'crm',
      'proof',
    ]);
    // None of the boundary methods is a send/dial/post/publish verb.
    const methodNames = Object.values(ports).flatMap((p) =>
      Object.keys(p as Record<string, unknown>),
    );
    expect(methodNames.sort()).toEqual([
      'check',
      'record',
      'requestAppointment',
      'requestApproval',
      'writeback',
    ]);
  });
});

describe('mock-safety: approval does not imply a live send', () => {
  it('an approved run completes through mock boundaries only — never a live send', async () => {
    const calls: string[] = [];
    const base = createMockCloserPorts({ approval: { status: 'approved', approvalRef: 'mock-approval' } });
    // Instrument every boundary so we can prove the ONLY outbound effects are the
    // five injected mock ports — there is no hidden send path after approval.
    const instrumented = {
      compliance: { check: async (...a: Parameters<typeof base.compliance.check>) => (calls.push('compliance.check'), base.compliance.check(...a)) },
      approval: { requestApproval: async (...a: Parameters<typeof base.approval.requestApproval>) => (calls.push('approval.requestApproval'), base.approval.requestApproval(...a)) },
      appointment: { requestAppointment: async (...a: Parameters<typeof base.appointment.requestAppointment>) => (calls.push('appointment.requestAppointment'), base.appointment.requestAppointment(...a)) },
      crm: { writeback: async (...a: Parameters<typeof base.crm.writeback>) => (calls.push('crm.writeback'), base.crm.writeback(...a)) },
      proof: { record: async (...a: Parameters<typeof base.proof.record>) => (calls.push('proof.record'), base.proof.record(...a)) },
    };

    const run = await createSalesCloserWorkflow(deterministicWorkflowOpts(instrumented)).run(
      FIXTURE_LEAD,
    );

    expect(run.status).toBe('completed');
    // Every recorded effect is one of the five known mock boundaries.
    const allowedCalls = new Set([
      'compliance.check',
      'approval.requestApproval',
      'appointment.requestAppointment',
      'crm.writeback',
      'proof.record',
    ]);
    expect(calls.every((c) => allowedCalls.has(c))).toBe(true);
    // Approval was reached, and the only post-approval effects are mock appointment/CRM/proof.
    expect(calls).toContain('approval.requestApproval');
    const postApproval = calls.slice(calls.indexOf('approval.requestApproval') + 1);
    // The post-approval path is exactly: book a (mock) appointment, write back to
    // the (mock) CRM, then record one (mock) proof per collected proof event.
    // No send/dial/post stage ever appears.
    expect(postApproval[0]).toBe('appointment.requestAppointment');
    expect(postApproval[1]).toBe('crm.writeback');
    const trailing = postApproval.slice(2);
    expect(trailing.length).toBeGreaterThan(0);
    expect(trailing.every((c) => c === 'proof.record')).toBe(true);
  });

  it('no transition stage represents an autonomous outbound send', async () => {
    const run = await createSalesCloserWorkflow(deterministicWorkflowOpts()).run(FIXTURE_LEAD);
    const allowedVia = new Set(['init', 'compliance', 'approval', 'appointment', 'crm', 'proof']);
    for (const t of run.transitions) {
      expect(allowedVia.has(t.via), `unexpected transition stage: ${t.via}`).toBe(true);
    }
    // There is no "send"/"dial"/"post"/"publish" stage anywhere in the path.
    expect(run.transitions.some((t) => /send|dial|post|publish/i.test(t.via))).toBe(false);
  });

  it('a pending approval halts the run with zero downstream effects (no auto-send)', async () => {
    const run = await createSalesCloserWorkflow(
      deterministicWorkflowOpts(createMockCloserPorts({ approval: { status: 'pending' } })),
    ).run(FIXTURE_LEAD);
    expect(run.status).toBe('awaiting_approval');
    expect(run.state).toBe('human_approval_required');
    expect(run.proofs).toEqual([]);
  });
});

describe('mock-safety: CRM writeback remains mock only', () => {
  it('the default CRM boundary returns a mock record ref, not a live write', async () => {
    const result = await createMockCloserPorts().crm.writeback({ prospectId: 'p1' });
    expect(result.status).toBe('ok');
    expect(result.recordRef).toMatch(/^mock-/);
  });

  it('a completed run records the mock CRM ref in proof details (no live CRM)', async () => {
    const run = await createSalesCloserWorkflow(deterministicWorkflowOpts()).run(FIXTURE_LEAD);
    expect(run.status).toBe('completed');
    const crmProof = run.proofs.find((p) => 'crmRecordRef' in (p.detailsPrivate ?? {}));
    expect(crmProof).toBeDefined();
    expect(String(crmProof?.detailsPrivate?.crmRecordRef)).toMatch(/^mock-/);
  });

  it('the spine ships exactly one CRM port factory, and it is the mock', () => {
    // `createMockCloserPorts` is the only port factory exported. A live CRM
    // client would be a *new* exported factory or a real `writeback` impl in
    // runtime — both are caught by the network/SDK and callable scans above.
    const factories = Object.keys(closerModule).filter((n) => /createMock.*Ports|createSalesCloser/i.test(n));
    expect(factories.sort()).toEqual(['createMockCloserPorts', 'createSalesCloserWorkflow']);
  });
});
