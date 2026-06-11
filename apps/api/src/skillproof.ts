import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Repository, SkillRow, SkillVersionRow, SkillProofRow } from '@cognitia/db';
import { z } from 'zod';

/**
 * SkillProof Core 20 (COG-005). Doctrine (Architecture Lock §1, §3):
 * SkillProof is a PRIVATE internal skill inventory + certification layer —
 * not a public marketplace, not a public registry, no paid or token-priced
 * listings. All skills are visibility=internal (0010 check enforces it).
 *
 * Proof tiers (numeric, on skill_versions.proof_tier):
 *   0 — registered/internal only, no verified proof
 *   1 — manifest/source verified (real file hashed at import time)
 *   2 — has a verified_fact proof from an audit/test/execution artifact
 *   3 — production-proven (NOT assignable in v1.1 — nothing is)
 *   4 — security-audited (NOT assignable in v1.1)
 * Tier >= 2 requires a verified_fact proof: enforced by the 0013 trigger,
 * mirrored in the in-memory repo, and re-checked here in the service.
 */

export const MAX_ASSIGNABLE_TIER = 2; // 3–4 exist in the enum but cannot be assigned in v1.1

interface SeedSkill {
  name: string;
  slug: string;
  category: string;
  description: string;
}

/**
 * The Core 20 seed set (categories per the mission brief). Only entries with
 * a real source in this repo get source_path + hashes (tier 1); the rest are
 * registered at tier 0 with evidence_tag likely_inference in their metadata —
 * no backing files exist in this environment (`/home/smrai/.hermes/skills`
 * is not accessible; documented in COG_005_006_DEPENDENCY_STATUS.md).
 */
const CORE_SKILLS: SeedSkill[] = [
  {
    name: 'Hermes Vision QC',
    slug: 'hermes-vision-qc',
    category: 'pii-redaction',
    description: 'Local vision QC + OCR privacy scanning before any media is published.',
  },
  {
    name: 'Cognitia Production Pipeline',
    slug: 'cognitia-production-pipeline',
    category: 'production-pipeline',
    description: 'End-to-end content/agent production pipeline orchestration.',
  },
  {
    name: 'Proof Gate',
    slug: 'proof-gate',
    category: 'proof-registry',
    description: 'Gates merges/claims on evidence-tagged proof records.',
  },
  {
    name: 'Task Memory',
    slug: 'task-memory',
    category: 'task-memory',
    description: 'Durable task state and recall across agent sessions.',
  },
  {
    name: 'Obsidian Knowledge Stack',
    slug: 'obsidian-knowledge-stack',
    category: 'knowledge',
    description: 'Knowledge-base curation and retrieval over the founder vault.',
  },
  {
    name: 'WSL-Windows Claude Bridge',
    slug: 'wsl-windows-claude-bridge',
    category: 'bridge',
    description: 'Cross-environment execution bridge between WSL and Windows agents.',
  },
  {
    name: 'Venture Audit',
    slug: 'venture-audit',
    category: 'audit',
    description: 'Structured venture/asset audit with evidence tagging.',
  },
  {
    name: 'Autonomous Task Verification',
    slug: 'autonomous-task-verification',
    category: 'verification',
    description: 'Verifies completed agent work against acceptance criteria.',
  },
  {
    name: 'Research Intelligence Pipeline',
    slug: 'research-intelligence-pipeline',
    category: 'research',
    description: 'Multi-source research gathering, verification, and synthesis.',
  },
  {
    name: 'Skillucate Deployment Funnel',
    slug: 'skillucate-deployment-funnel',
    category: 'deployment',
    description: 'Deployment and funnel operations for the Skillucate property.',
  },
  {
    name: 'Inlet Move Debug/Fix',
    slug: 'inlet-move-debug-fix',
    category: 'moveros',
    description: 'Diagnosis and fixes for the Inlet Move stack.',
  },
  {
    name: 'Slack Monitor Cron',
    slug: 'slack-monitor-cron',
    category: 'ops',
    description: 'Scheduled Slack monitoring and alert routing.',
  },
  {
    name: 'Watchtower Competitor Scan',
    slug: 'watchtower-competitor-scan',
    category: 'research',
    description: 'Recurring competitor and market scanning.',
  },
  {
    name: 'Video Production Pipeline',
    slug: 'video-production-pipeline',
    category: 'production-pipeline',
    description: 'Scripted video assembly, QC, and publish gating.',
  },
  {
    name: 'Google Workspace Ops',
    slug: 'google-workspace-ops',
    category: 'ops',
    description: 'Docs/Sheets/Drive automation under policy.',
  },
  {
    name: 'Outreach Machine',
    slug: 'outreach-machine',
    category: 'outreach',
    description: 'Governed outreach sequencing (approval-gated, no real sends without policy).',
  },
  {
    name: 'MoverOS Audit',
    slug: 'moveros-audit',
    category: 'moveros',
    description: 'Operational audit of MoverOS lead handling and SLAs.',
  },
  {
    name: 'ATC Operations',
    slug: 'atc-operations',
    category: 'atc',
    description: 'Agent Trust Credential issuance and lifecycle operations.',
  },
  {
    name: 'Proof Registry Operations',
    slug: 'proof-registry-operations',
    category: 'proof-registry',
    description: 'Proof creation, supersede chains, and redaction checks.',
  },
  {
    name: 'AI Front Desk Lead Rescue',
    slug: 'ai-front-desk-lead-rescue',
    category: 'moveros',
    description: 'SMS-first simulated lead rescue with approval-gated actions.',
  },
];

/** Real, in-repo source for the Hermes vision skill (tier 1 evidence). */
const REAL_SOURCES: Record<string, string> = {
  'hermes-vision-qc': 'hermes/skills/vision-skill',
};

function sha256(data: string | Buffer): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

/** Hash a source directory's files (names + contents), read-only. */
function hashSourceDir(absDir: string): { manifest_hash: string | null; content_hash: string } {
  const files = readdirSync(absDir)
    .filter((f) => statSync(join(absDir, f)).isFile())
    .sort();
  const content = createHash('sha256');
  let manifestHash: string | null = null;
  for (const file of files) {
    const bytes = readFileSync(join(absDir, file));
    content.update(file).update(bytes);
    if (file === 'skill.yaml' || file === 'manifest.json') manifestHash = sha256(bytes);
  }
  return { manifest_hash: manifestHash, content_hash: `sha256:${content.digest('hex')}` };
}

export interface ImportSummary {
  imported: number;
  with_real_source: number;
  seeded_without_source: number;
  skipped_existing: number;
}

/**
 * Import/seed the Core 20. Idempotent: existing slugs are skipped. Never
 * writes to the source directories (read-only crawl of in-repo `hermes/`).
 */
export async function importCoreSkills(
  repo: Repository,
  tenantId: string,
  repoRoot: string,
  actorRef: string,
): Promise<ImportSummary> {
  const ts = new Date().toISOString();
  let imported = 0;
  let withSource = 0;
  let skipped = 0;

  for (const seed of CORE_SKILLS) {
    const existing = (await repo.listSkills(tenantId)).find((s) => s.slug === seed.slug);
    if (existing) {
      skipped += 1;
      continue;
    }
    const sourceRel = REAL_SOURCES[seed.slug];
    const sourceAbs = sourceRel ? join(repoRoot, sourceRel) : null;
    const hasSource = !!(sourceAbs && existsSync(sourceAbs));
    const hashes = hasSource
      ? hashSourceDir(sourceAbs!)
      : { manifest_hash: null, content_hash: sha256(`seed:${seed.slug}`) };

    const skill: SkillRow = {
      id: randomUUID(),
      tenant_id: tenantId,
      name: seed.name,
      slug: seed.slug,
      category: seed.category,
      description: seed.description,
      visibility: 'internal',
      namespace: 'cognitia.core',
      source_path: hasSource ? sourceRel! : null,
      owner_agent_id: null,
      created_at: ts,
      updated_at: ts,
    };
    const saved = await repo.upsertSkill(skill);
    await repo.insertSkillVersion({
      id: randomUUID(),
      tenant_id: tenantId,
      skill_id: saved.id,
      version: '0.1.0',
      spec: {},
      status: 'active',
      manifest_hash: hashes.manifest_hash,
      content_hash: hashes.content_hash,
      metadata: {
        x_cognitia_metadata: {
          // Honest provenance: a real file is a verified_fact; a seed is not.
          evidence_tag: hasSource ? 'verified_fact' : 'likely_inference',
          seeded: !hasSource,
          imported_at: ts,
          imported_by: actorRef,
        },
      },
      // Tier 1 only when a real source file was hashed; otherwise tier 0.
      proof_tier: hasSource ? 1 : 0,
      yanked: false,
      yank_reason: null,
      created_at: ts,
      updated_at: ts,
    });
    imported += 1;
    if (hasSource) withSource += 1;
  }

  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'skillproof.core_import.v1',
    subject_ref: 'skills:core-20',
    detail: { imported, with_real_source: withSource, skipped_existing: skipped },
    occurred_at: ts,
    created_at: ts,
  });

  return {
    imported,
    with_real_source: withSource,
    seeded_without_source: imported - withSource,
    skipped_existing: skipped,
  };
}

const skillProofBody = z.object({
  proof_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  tier: z.enum(['T0_claimed', 'T1_demonstrated', 'T2_verified', 'T3_economically_proven']),
  target_proof_tier: z.number().int().min(0).max(4).optional(),
});

/**
 * Certify a skill version: record a skill_proof (0010 trigger gates T2+ on
 * verified_fact) and optionally upgrade the version's numeric proof tier
 * through validateProofTierUpgrade.
 */
export async function createSkillProof(
  repo: Repository,
  tenantId: string,
  skillVersionId: string,
  body: unknown,
  actorRef: string,
): Promise<{ skill_proof: SkillProofRow; version: SkillVersionRow }> {
  const input = skillProofBody.parse(body ?? {});
  const version = await repo.getSkillVersion(tenantId, skillVersionId);
  if (!version) throw new SkillVersionNotFoundError(skillVersionId);
  if (version.yanked) throw new SkillVersionYankedError(skillVersionId);
  const proof = await repo.getProof(tenantId, input.proof_id);
  if (!proof) throw new SkillProofTargetError(`proof not found: ${input.proof_id}`);

  const ts = new Date().toISOString();
  const skillProof = await repo.insertSkillProof({
    id: randomUUID(),
    tenant_id: tenantId,
    skill_id: version.skill_id,
    agent_id: input.agent_id,
    proof_id: input.proof_id,
    tier: input.tier,
    evidence_tag: proof.evidence_tag,
    created_at: ts,
    updated_at: ts,
  });

  let updated = version;
  if (input.target_proof_tier !== undefined) {
    updated = await validateProofTierUpgrade(
      repo,
      tenantId,
      skillVersionId,
      input.target_proof_tier,
    );
  }

  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'skillproof.certified.v1',
    subject_ref: `skill_version:${skillVersionId}`,
    detail: { tier: input.tier, proof_id: input.proof_id, proof_tier: updated.proof_tier },
    occurred_at: ts,
    created_at: ts,
  });
  return { skill_proof: skillProof, version: updated };
}

/**
 * Tier upgrade validation (doctrine §6.5): tier >= 2 requires a verified_fact
 * proof; tiers 3–4 are not assignable in v1.1 at all (no faked production or
 * security evidence). DB trigger + memory mirror back this up.
 */
export async function validateProofTierUpgrade(
  repo: Repository,
  tenantId: string,
  skillVersionId: string,
  targetTier: number,
): Promise<SkillVersionRow> {
  const version = await repo.getSkillVersion(tenantId, skillVersionId);
  if (!version) throw new SkillVersionNotFoundError(skillVersionId);
  if (version.yanked) throw new SkillVersionYankedError(skillVersionId);
  if (targetTier > MAX_ASSIGNABLE_TIER) {
    throw new TierNotAssignableError(targetTier);
  }
  if (targetTier >= 2) {
    const proofs = await repo.listSkillProofs(tenantId, version.skill_id);
    const verified = [];
    for (const sp of proofs) {
      const proof = await repo.getProof(tenantId, sp.proof_id);
      if (proof?.evidence_tag === 'verified_fact') verified.push(sp);
    }
    if (verified.length === 0) {
      throw new TierEvidenceError(skillVersionId, targetTier);
    }
  }
  const updated = await repo.setSkillVersionTier(tenantId, skillVersionId, targetTier);
  if (!updated) throw new SkillVersionNotFoundError(skillVersionId);
  return updated;
}

export async function yankSkillVersion(
  repo: Repository,
  tenantId: string,
  skillVersionId: string,
  reason: string,
  actorRef: string,
): Promise<SkillVersionRow> {
  const updated = await repo.yankSkillVersion(tenantId, skillVersionId, reason);
  if (!updated) throw new SkillVersionNotFoundError(skillVersionId);
  const ts = new Date().toISOString();
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'skillproof.version_yanked.v1',
    subject_ref: `skill_version:${skillVersionId}`,
    detail: { reason },
    occurred_at: ts,
    created_at: ts,
  });
  return updated;
}

export class SkillVersionNotFoundError extends Error {
  constructor(id: string) {
    super(`skill version not found: ${id}`);
    this.name = 'SkillVersionNotFoundError';
  }
}
export class SkillVersionYankedError extends Error {
  constructor(id: string) {
    super(`skill version ${id} is yanked and cannot be certified or upgraded`);
    this.name = 'SkillVersionYankedError';
  }
}
export class SkillProofTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillProofTargetError';
  }
}
export class TierNotAssignableError extends Error {
  constructor(tier: number) {
    super(
      `proof tier ${tier} is not assignable in v1.1 (max ${MAX_ASSIGNABLE_TIER}); production/security tiers require real evidence processes`,
    );
    this.name = 'TierNotAssignableError';
  }
}
export class TierEvidenceError extends Error {
  constructor(versionId: string, tier: number) {
    super(`skill version ${versionId}: tier ${tier} requires a verified_fact proof`);
    this.name = 'TierEvidenceError';
  }
}
