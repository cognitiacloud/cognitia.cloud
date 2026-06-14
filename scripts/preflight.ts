/**
 * Deploy-readiness preflight CLI (Item 7).
 *
 * Prints the readiness report for the CURRENT environment and exits non-zero if
 * any check failed — so it can gate a deploy pipeline:
 *
 *   pnpm run preflight
 *
 * It does NOT deploy, connect to a database, or mutate anything; it only reads
 * the environment through the same validators boot uses (apps/api/src/secrets).
 *
 * Runtime note: the API sources use `.js` import specifiers (TS "Bundler"
 * resolution) which `node --experimental-strip-types` does not remap. The tiny
 * resolve hook below retries `.ts` for a relative `.js` that does not exist on
 * disk, so the CLI can run the source directly with no build step.
 */
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(
      "export async function resolve(s,c,next){if((s.startsWith('./')||s.startsWith('../'))&&s.endsWith('.js')){try{return await next(s,c)}catch(e){if(e&&e.code==='ERR_MODULE_NOT_FOUND')return next(s.slice(0,-3)+'.ts',c);throw e}}return next(s,c)}",
    ),
  import.meta.url,
);

const { preflightReadiness, formatReadinessReport } =
  await import('../apps/api/src/preflightReadiness.ts');

const report = preflightReadiness();
process.stdout.write(formatReadinessReport(report) + '\n');
process.exit(report.ok ? 0 : 1);
