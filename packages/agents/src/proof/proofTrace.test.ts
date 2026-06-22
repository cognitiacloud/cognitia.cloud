import { describe, it, expect } from 'vitest';
import { assembleIntegratedRunPacket } from '../gtm-os/integration/runPacket.js';
import {
  buildProofActionTrace,
  buildTrustOpsReportFromPackets,
  assertProofTraceNoRawPii,
  PROOF_ACTION_TRACE_SCHEMA,
  PROOF_TRACE_STAGES,
  type ProofActionTrace,
} from './proofTrace.js';

/** Deterministic clock + id generator so traces are reproducible in tests. */
function deterministicDeps() {
  let t = Date.parse('2026-06-22T12:00:00.000Z');
  let n = 0;
  return {
    now: () => new Date((t += 1000)),
    newId: () => `id_${(++n).toString(36)}`,
  };
}

const HAPPY_LEAD = {
  companyName: 'Northshore Auto Group',
  source: 'public_registry',
  sourceRisk: 'low' as const,
  contactBasis: 'conspicuously_published_business_contact' as const,
  consentStatus: 'implied_possible' as const,
  unsubscribeStatus: 'subscribed' as const,
  doNotContact: false,
};

async function happyPacket() {
  return assembleIntegratedRunPacket({
    lead: HAPPY_LEAD,
    channels: ['email', 'sms', 'crm_writeback'],
    ...deterministicDeps(),
  });
}

async function complianceBlockedPacket() {
  return assembleIntegratedRunPacket({
    lead: {
      companyName: 'Do-Not-Contact Motors',
      source: 'public_registry',
      sourceRisk: 'high',
      consentStatus: 'do_not_contact',
      doNotContact: true,
    },
    portOverrides: { compliance: { status: 'blocked', reason: 'do_not_contact' } },
    ...deterministicDeps(),
  });
}

describe('buildProofActionTrace — correlated end-to-end spine', () => {
  it('maps the happy path across every canonical stage in order', async () => {
    const trace = buildProofActionTrace(await happyPacket());

    expect(trace.schema).toBe(PROOF_ACTION_TRACE_SCHEMA);
    expect(trace.mode).toBe('mock');
    expect(trace.complete).toBe(true);

    // Every canonical stage present and in the canonical order.
    const stages = trace.steps.map((s) => s.stage);
    expect(stages).toEqual([...PROOF_TRACE_STAGES]);

    // Steps are sequentially numbered from 1.
    expect(trace.steps.map((s) => s.seq)).toEqual(trace.steps.map((_, i) => i + 1));

    // Coverage checklist agrees with the steps.
    expect(trace.coverage.every((c) => c.present)).toBe(true);
  });

  it('correlates every step on the same opaque run id + workspace', async () => {
    const trace = buildProofActionTrace(await happyPacket());
    const ids = new Set(trace.steps.map((s) => s.correlationId));
    const workspaces = new Set(trace.steps.map((s) => s.workspaceId));
    expect(ids.size).toBe(1);
    expect(workspaces.size).toBe(1);
    expect([...ids][0]).toBe(trace.correlationId);
    expect([...workspaces][0]).toBe('budget_wheels_demo');
  });

  it('references the real underlying evidence (proofs, plan refs, CRM events, trust score)', async () => {
    const packet = await happyPacket();
    const trace = buildProofActionTrace(packet);

    const planStep = trace.steps.find((s) => s.stage === 'dry_run_plan')!;
    expect(planStep.outcome).toBe('planned');
    // Plan refs in the trace match the real B2 channel plan refs.
    const traceRefs = planStep.refs.map((r) => r.ref).sort();
    const realRefs = packet.channelPlans.map((p) => p.planRef).sort();
    expect(traceRefs).toEqual(realRefs);

    const crmStep = trace.steps.find((s) => s.stage === 'crm_lite')!;
    expect(crmStep.refs.some((r) => r.label === 'opportunity')).toBe(true);

    const trustStep = trace.steps.find((s) => s.stage === 'trustops')!;
    expect(trustStep.outcome).toBe('computed');
    expect(trustStep.refs.find((r) => r.label === 'trust_score')!.ref).toBe(
      String(packet.trustOps.score.score),
    );
  });

  it('is honest for a compliance-blocked run: no fabricated downstream stages', async () => {
    const trace = buildProofActionTrace(await complianceBlockedPacket());

    const stages = trace.steps.map((s) => s.stage);
    expect(stages).toContain('lead');
    expect(stages).toContain('compliance');
    // No approval / dry-run plan / CRM-lite evidence was fabricated.
    expect(stages).not.toContain('approval');
    expect(stages).not.toContain('dry_run_plan');
    expect(stages).not.toContain('crm_lite');
    expect(trace.complete).toBe(false);

    const complianceStep = trace.steps.find((s) => s.stage === 'compliance')!;
    expect(complianceStep.outcome).toBe('blocked');

    // Coverage reflects the truth.
    const byStage = new Map(trace.coverage.map((c) => [c.stage, c.present]));
    expect(byStage.get('compliance')).toBe(true);
    expect(byStage.get('dry_run_plan')).toBe(false);
  });

  it('is deterministic: identical inputs yield an identical trace', async () => {
    const a = buildProofActionTrace(await happyPacket());
    const b = buildProofActionTrace(await happyPacket());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('records a no-live-egress / no-PII attestation', async () => {
    const trace = buildProofActionTrace(await happyPacket());
    expect(trace.attestation.noLiveEgress).toBe(true);
    expect(trace.attestation.noRawPii).toBe(true);
    expect(trace.attestation.mode).toBe('mock');
  });
});

describe('buildTrustOpsReportFromPackets — TrustOps over real integrated packets', () => {
  it('computes a funnel + bounded trust score from the packets themselves', async () => {
    const packets = [await happyPacket(), await complianceBlockedPacket()];
    const report = buildTrustOpsReportFromPackets(packets);

    expect(report.metrics.funnel.leadsReceived).toBe(2);
    expect(report.metrics.funnel.complianceBlock).toBe(1);
    expect(report.metrics.funnel.compliancePass).toBe(1);
    expect(report.score.score).toBeGreaterThanOrEqual(0);
    expect(report.score.score).toBeLessThanOrEqual(100);
    expect(report.markdown).toMatch(/MOCK|SANDBOX/i);
  });

  it('matches the single-packet TrustOps embedded in the integrated packet', async () => {
    const packet = await happyPacket();
    const report = buildTrustOpsReportFromPackets([packet]);
    // The packet already embeds a single-run TrustOps report; recomputing from
    // the same run must agree (proves it is the real packet output, not a mirror).
    expect(report.score.score).toBe(packet.trustOps.score.score);
    expect(report.metrics.funnel.leadsReceived).toBe(1);
  });
});

/* --------------------------------------------------------------- PII proofs */

describe('no raw PII in proof trace / report outputs', () => {
  it('the happy-path trace passes the PII guard', async () => {
    const trace = buildProofActionTrace(await happyPacket());
    expect(() => assertProofTraceNoRawPii(trace)).not.toThrow();
  });

  it('the blocked-path trace passes the PII guard', async () => {
    const trace = buildProofActionTrace(await complianceBlockedPacket());
    expect(() => assertProofTraceNoRawPii(trace)).not.toThrow();
  });

  it('the serialized trace contains no real-looking email addresses', async () => {
    const trace = buildProofActionTrace(await happyPacket());
    const serialized = JSON.stringify(trace);
    const emails = serialized.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    for (const email of emails) {
      const lower = email.toLowerCase();
      const reserved =
        lower.endsWith('.example') || lower.endsWith('.test') || lower.endsWith('.invalid');
      expect(reserved || email.includes('*')).toBe(true);
    }
  });

  it('the TrustOps report markdown contains no real-looking email addresses', async () => {
    const report = buildTrustOpsReportFromPackets([await happyPacket()]);
    const emails = report.markdown.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
    expect(emails).toHaveLength(0);
  });

  it('the guard THROWS when a raw email is injected into a step summary', async () => {
    const trace = buildProofActionTrace(await happyPacket());
    const tampered: ProofActionTrace = {
      ...trace,
      steps: trace.steps.map((s, i) =>
        i === 0 ? { ...s, summary: `${s.summary} contact victim@gmail.com` } : s,
      ),
    };
    expect(() => assertProofTraceNoRawPii(tampered)).toThrow(/raw email PII/);
  });

  it('the guard THROWS when a raw phone is injected into a step summary', async () => {
    const trace = buildProofActionTrace(await happyPacket());
    const tampered: ProofActionTrace = {
      ...trace,
      steps: trace.steps.map((s, i) =>
        i === 0 ? { ...s, summary: `${s.summary} call 415-872-9931` } : s,
      ),
    };
    expect(() => assertProofTraceNoRawPii(tampered)).toThrow(/raw phone PII/);
  });

  it('the guard ALLOWS reserved-range synthetic contacts', async () => {
    const trace = buildProofActionTrace(await happyPacket());
    const ok: ProofActionTrace = {
      ...trace,
      steps: trace.steps.map((s, i) =>
        i === 0 ? { ...s, summary: `${s.summary} preview lead@buyer.example / +1-555-0142` } : s,
      ),
    };
    expect(() => assertProofTraceNoRawPii(ok)).not.toThrow();
  });
});

/* ------------------------------------------------------- no live egress in source */

describe('source contains no live egress / network imports', () => {
  it('the proof module imports no network or vendor SDK', async () => {
    const fs = await import('node:fs');
    const url = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.join(here, 'proofTrace.ts'), 'utf8');
    // No network/runtime egress primitives in the module source.
    expect(/\bfetch\s*\(/.test(src)).toBe(false);
    expect(/from\s+['"](axios|node-fetch|undici|nodemailer|twilio|@sendgrid)/.test(src)).toBe(
      false,
    );
    expect(/require\(['"](http|https|net)['"]\)/.test(src)).toBe(false);
  });
});
