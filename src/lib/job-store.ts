import { randomUUID } from 'crypto';
import type { Job, JobOptions } from './types';

const globalForJobs = globalThis as unknown as { __siftJobs?: Map<string, Job> };

const jobs = globalForJobs.__siftJobs ?? new Map<string, Job>();
globalForJobs.__siftJobs = jobs;

export function createJob(options: JobOptions): Job {
  const job: Job = {
    id: randomUUID(),
    options,
    status: 'running',
    stats: {
      pagesCrawled: 0,
      imagesFound: 0,
      matchesFound: 0,
      currentUrl: '',
      startedAt: Date.now(),
    },
    log: [],
    results: [],
    cancelRequested: false,
    referencePixels: null,
    seenImages: new Map(),
    seenPagesForImage: new Map(),
    listeners: new Set(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function notifyJob(job: Job) {
  for (const listener of job.listeners) listener({ type: 'update' });
}

const MAX_LOG = 200;

export function pushLog(job: Job, entry: Job['log'][number]) {
  job.log.push(entry);
  if (job.log.length > MAX_LOG) job.log.shift();
}

export function elapsedLabel(job: Job): string {
  const secs = Math.floor((Date.now() - job.stats.startedAt) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
