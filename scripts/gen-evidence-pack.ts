/**
 * Generator for the machine-readable evidence pack (Item 5).
 *
 * Writes docs/security/evidence-pack.json from the single source of truth in
 * apps/api/src/evidencePack.ts. The committed JSON is verified against this
 * render by apps/api/src/evidencePack.test.ts (a drift guard), so the JSON can
 * never silently diverge from the typed constant.
 *
 * Run with:  pnpm run evidence:gen
 * (executes via `node --experimental-strip-types`, no build step needed.)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderEvidenceJson } from '../apps/api/src/evidencePack.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'docs', 'security', 'evidence-pack.json');
writeFileSync(out, renderEvidenceJson());
process.stdout.write(`wrote ${out}\n`);
