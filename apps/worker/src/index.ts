/**
 * Background worker entry point (scaffold).
 *
 * Responsibilities (as features land): CRM sync runs, scheduled agent runs,
 * embedding/indexing, eval runs. No business logic yet — this is the process
 * shell. Jobs are pure functions in packages/agents/* invoked here.
 */
import { log } from '@cognitia/core';

export interface Job {
  name: string;
  run(): Promise<void>;
}

// Jobs are registered by the runtime once their inputs (DB repo, connected
// integration clients) are resolved. See ./jobs/crmSync.ts for the crm-sync job.
const jobs: Job[] = [
  // TODO: mira-scheduled, embed-documents, eval-run jobs.
];

export { crmSyncJob } from './jobs/crmSync.js';

export async function runRegisteredJobs(): Promise<void> {
  for (const job of jobs) {
    log({ level: 'info', message: `job.start:${job.name}` });
    await job.run();
    log({ level: 'info', message: `job.done:${job.name}` });
  }
}

const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  runRegisteredJobs().then(() => log({ level: 'info', message: 'worker.idle' }));
}
