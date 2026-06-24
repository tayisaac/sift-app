import { NextResponse } from 'next/server';
import { getJob, elapsedLabel } from '@/lib/job-store';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    status: job.status,
    error: job.error ?? null,
    options: {
      domain: job.options.domain,
      method: job.options.method,
      threshold: job.options.threshold,
      maxPages: job.options.maxPages,
      referenceFilename: job.options.referenceFilename,
    },
    stats: {
      pagesCrawled: job.stats.pagesCrawled,
      imagesFound: job.stats.imagesFound,
      matchesFound: job.stats.matchesFound,
      currentUrl: job.stats.currentUrl,
      elapsed: elapsedLabel(job),
    },
    log: job.log.slice(-30).reverse(),
    resultsCount: job.results.length,
  });
}
