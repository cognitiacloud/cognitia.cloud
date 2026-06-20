import { spawn } from 'node:child_process';
import { env } from '@cognitia/config';

export interface WebsiteAuditResult {
  provider: string;
  hasPii: boolean;
  privacyFlags: string[];
  notes: string;
}

export interface VisionBridge {
  /** QC a captured website screenshot for PII / privacy / quality issues. */
  auditScreenshot(imagePath: string): Promise<WebsiteAuditResult>;
}

/** Deterministic bridge used in MOCK_MODE and tests (no python required). */
export class MockVisionBridge implements VisionBridge {
  async auditScreenshot(imagePath: string): Promise<WebsiteAuditResult> {
    const hasPii = imagePath.includes('secret');
    return {
      provider: 'mock',
      hasPii,
      privacyFlags: hasPii ? ['email_detected'] : [],
      notes: 'Mock audit result.',
    };
  }
}

/**
 * Real bridge: shells out to the existing python hermes vision-skill
 * (`vision_skill.py privacy <image>`) and maps its JSON to a WebsiteAuditResult.
 * The skill is reused as-is — no rewrite.
 */
export class HermesVisionBridge implements VisionBridge {
  constructor(private readonly skillPath = env.HERMES_VISION_SKILL_PATH) {}

  auditScreenshot(imagePath: string): Promise<WebsiteAuditResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn('python3', [this.skillPath, 'privacy', imagePath]);
      let out = '';
      let err = '';
      proc.stdout.on('data', (d) => (out += d.toString()));
      proc.stderr.on('data', (d) => (err += d.toString()));
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`vision-skill exited ${code}: ${err}`));
        try {
          const parsed = JSON.parse(out) as {
            findings?: string[];
            has_pii?: boolean;
            notes?: string;
          };
          resolve({
            provider: 'hermes-vision',
            hasPii: Boolean(parsed.has_pii),
            privacyFlags: parsed.findings ?? [],
            notes: parsed.notes ?? '',
          });
        } catch (e) {
          reject(new Error(`Failed to parse vision-skill output: ${(e as Error).message}`));
        }
      });
    });
  }
}

/** Resolve the active vision bridge. MOCK_MODE forces the mock. */
export function getVisionBridge(): VisionBridge {
  return env.MOCK_MODE ? new MockVisionBridge() : new HermesVisionBridge();
}
