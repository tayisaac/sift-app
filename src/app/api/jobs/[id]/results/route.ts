import { NextResponse } from 'next/server';
import { getJob } from '@/lib/job-store';
import { filterAndSort } from '@/lib/results';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const sortDir = searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize') ?? 9)));

  const sorted = filterAndSort(job.results, q, sortDir);
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return NextResponse.json({
    rows,
    total,
    page,
    pageSize,
    domain: job.options.domain,
    method: job.options.method,
    threshold: job.options.threshold,
    referenceFilename: job.options.referenceFilename,
    pagesCrawled: job.stats.pagesCrawled,
    totalMatches: job.results.length,
    matchedPages: new Set(job.results.map((r) => r.pageUrl)).size,
  });
}
