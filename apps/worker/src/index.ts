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

const jobs: Job[] = [
  // TODO: register crm-sync, mira-scheduled, embed-documents, eval-run jobs.
];

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
