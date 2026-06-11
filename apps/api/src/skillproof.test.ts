import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * COG-005 — SkillProof Core 20 (mission §14): seed/import, internal-only
 * visibility, content hashes, tier rules (0–2 implemented; 3–4 unassignable;
 * tier 2 requires verified_fact), yank semantics, tenant safety, and the
 * no-marketplace doctrine.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-skillproof', ...over });

describe('SkillProof Core 20 (COG-005)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  const importCore = () => handlers.importCoreSkills(asRole('operator'));

  const registerAgent = async () => {
    const res = await handlers.registerAgent(
      asRole('operator', { body: { name: 'Certifier', slug: 'certifier' } }),
    );
    return (res.body as { agent: { id: string } }).agent.id;
  };

  const makeProof = async (tag: string) => {
    const res = await handlers.createProof(
      asRole('operator', {
        body: {
          kind: 'skill_demo',
          subject_type: 'skill',
          subject_id: 'c0a00000-0000-0000-0000-000000000001',
          evidence_tag: tag,
          ...(tag === 'verified_fact'
            ? { evidence_ref: 'test:run:1', verifier_ref: 'user:operator' }
            : {}),
        },
      }),
    );
    return (res.body as { proof: { id: string } }).proof.id;
  };

  it('imports the Core 20: internal-only, hashed, idempotent (#1, #2, #3)', async () => {
    const first = await importCore();
    const summary = first.body as {
      imported: number;
      with_real_source: number;
      seeded_without_source: number;
    };
    expect(summary.imported).toBe(20);
    // Exactly one skill has a real in-repo source (hermes vision skill);
    // the other 19 are seeds (likely_inference) — no fake import claims.
    expect(summary.with_real_source).toBe(1);
    expect(summary.seeded_without_source).toBe(19);

    const skills = await repo.listSkills(TENANT);
    expect(skills).toHaveLength(20);
    expect(skills.every((s) => s.visibility === 'internal')).toBe(true);
    expect(skills.every((s) => s.namespace === 'cognitia.core')).toBe(true);

    // Every version carries a content hash; the real import has tier 1 + manifest hash.
    for (const skill of skills) {
      const [version] = await repo.listSkillVersions(TENANT, skill.id);
      expect(version!.content_hash).toMatch(/^sha256:/);
      expect(version!.yanked).toBe(false);
      if (skill.slug === 'hermes-vision-qc') {
        expect(skill.source_path).toBe('hermes/skills/vision-skill');
        expect(version!.proof_tier).toBe(1);
        expect(version!.manifest_hash).toMatch(/^sha256:/);
      } else {
        expect(skill.source_path).toBeNull();
        expect(version!.proof_tier).toBe(0); // tier 0 needs no proof (#4)
        const meta = version!.metadata as { x_cognitia_metadata: { evidence_tag: string } };
        expect(meta.x_cognitia_metadata.evidence_tag).toBe('likely_inference');
      }
    }

    // Idempotent re-import.
    const second = await importCore();
    expect((second.body as { skipped_existing: number }).skipped_existing).toBe(20);
    expect(await repo.listSkills(TENANT)).toHaveLength(20);
  });

  it('tier 2 requires a verified_fact proof; inference/unknown are rejected (#6, #7, #8)', async () => {
    await importCore();
    const skills = await repo.listSkills(TENANT);
    const skill = skills.find((s) => s.slug === 'hermes-vision-qc')!;
    const [version] = await repo.listSkillVersions(TENANT, skill.id);
    const agentId = await registerAgent();

    // No proof at all → tier 2 rejected.
    await expect(
      handlers.upgradeSkillVersionTier(
        asRole('operator', { params: { id: version!.id }, body: { target_tier: 2 } }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    // likely_inference / unknown certifications cannot reach T2 nor unlock tier 2.
    for (const tag of ['likely_inference', 'unknown']) {
      const proofId = await makeProof(tag);
      await expect(
        handlers.createSkillProof(
          asRole('operator', {
            params: { id: version!.id },
            body: { proof_id: proofId, agent_id: agentId, tier: 'T2_verified' },
          }),
        ),
      ).rejects.toMatchObject({ status: 409 });
      await handlers.createSkillProof(
        asRole('operator', {
          params: { id: version!.id },
          body: { proof_id: proofId, agent_id: agentId, tier: 'T1_demonstrated' },
        }),
      );
      await expect(
        handlers.upgradeSkillVersionTier(
          asRole('operator', { params: { id: version!.id }, body: { target_tier: 2 } }),
        ),
      ).rejects.toMatchObject({ status: 409 });
    }

    // verified_fact certification unlocks tier 2.
    const verifiedProof = await makeProof('verified_fact');
    const certified = await handlers.createSkillProof(
      asRole('operator', {
        params: { id: version!.id },
        body: {
          proof_id: verifiedProof,
          agent_id: agentId,
          tier: 'T2_verified',
          target_proof_tier: 2,
        },
      }),
    );
    expect((certified.body as { version: { proof_tier: number } }).version.proof_tier).toBe(2);
  });

  it('tiers 3 and 4 are not assignable in v1.1 (no faked production/security evidence)', async () => {
    await importCore();
    const skill = (await repo.listSkills(TENANT))[0]!;
    const [version] = await repo.listSkillVersions(TENANT, skill.id);
    for (const tier of [3, 4]) {
      await expect(
        handlers.upgradeSkillVersionTier(
          asRole('operator', { params: { id: version!.id }, body: { target_tier: tier } }),
        ),
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it('yanked versions cannot be certified or upgraded (#9)', async () => {
    await importCore();
    const skill = (await repo.listSkills(TENANT))[0]!;
    const [version] = await repo.listSkillVersions(TENANT, skill.id);

    await expect(
      handlers.yankSkillVersion(asRole('operator', { params: { id: version!.id }, body: {} })),
    ).resolves.toMatchObject({ status: 400 }); // reason required

    const yanked = await handlers.yankSkillVersion(
      asRole('operator', { params: { id: version!.id }, body: { reason: 'superseded by v2' } }),
    );
    expect((yanked.body as { version: { yanked: boolean } }).version.yanked).toBe(true);

    const agentId = await registerAgent();
    const proofId = await makeProof('verified_fact');
    await expect(
      handlers.createSkillProof(
        asRole('operator', {
          params: { id: version!.id },
          body: { proof_id: proofId, agent_id: agentId, tier: 'T1_demonstrated' },
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      handlers.upgradeSkillVersionTier(
        asRole('operator', { params: { id: version!.id }, body: { target_tier: 1 } }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('routes are tenant-safe and role-gated (#10)', async () => {
    await importCore();
    const other = await handlers.listSkills(
      asRole('viewer', { tenantId: '22222222-2222-2222-2222-222222222222' }),
    );
    expect((other.body as { skills: unknown[] }).skills).toHaveLength(0);
    await expect(handlers.importCoreSkills(asRole('viewer'))).rejects.toMatchObject({
      status: 403,
    });
  });

  it('no public marketplace exists: no marketplace/pricing routes or pages (#11, #12)', async () => {
    // Server routes: no marketplace/buy/pricing/token PATH was registered
    // (route strings, not comments).
    const serverSrc = readFileSync(join(here, 'server.ts'), 'utf8');
    const routePaths = [...serverSrc.matchAll(/app\.\w+\('([^']+)'/g)].map((m) => m[1]!);
    expect(routePaths.some((p) => /marketplace|buy|pricing|token|listing/i.test(p))).toBe(false);

    // Web app: no marketplace route directory exists.
    const appDir = join(repoRoot, 'apps', 'web', 'src', 'app');
    const dirs: string[] = [];
    const visit = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          dirs.push(entry.name.toLowerCase());
          visit(join(d, entry.name));
        }
      }
    };
    visit(appDir);
    expect(dirs.some((d) => /marketplace|pricing|token/.test(d))).toBe(false);

    // Skill listings carry no price fields.
    await importCore();
    const list = await handlers.listSkills(asRole('viewer'));
    expect(JSON.stringify(list.body)).not.toMatch(/"price|token_price|cost_usd/i);
  });
});
