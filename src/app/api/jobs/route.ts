import { NextRequest, NextResponse } from 'next/server';
import { createJob, notifyJob } from '@/lib/job-store';
import { runCrawl } from '@/lib/crawler';
import { sanitizeDomain } from '@/lib/validate';
import type { Method } from '@/lib/types';

export async function POST(request: NextRequest) {
  const form = await request.formData();

  const domainRaw = String(form.get('domain') ?? '');
  const domainResult = sanitizeDomain(domainRaw);
  if (!domainResult.ok) {
    return NextResponse.json({ error: domainResult.error }, { status: 400 });
  }

  const method = String(form.get('method') ?? 'pixel') as Method;
  if (method !== 'filename' && method !== 'pixel') {
    return NextResponse.json({ error: 'Invalid comparison method.' }, { status: 400 });
  }

  const threshold = Math.max(0, Math.min(100, Number(form.get('threshold') ?? 80)));
  const maxDepth = Math.max(1, Math.min(20, Number(form.get('maxDepth') ?? 5)));
  const maxPages = Math.max(1, Math.min(10_000, Number(form.get('maxPages') ?? 500)));
  const parallel = String(form.get('parallel') ?? 'true') === 'true';

  const referenceFilename = String(form.get('referenceFilename') ?? '').trim();
  const file = form.get('referenceImage');

  let referenceImage: { buffer: Buffer; mimeType: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    referenceImage = { buffer, mimeType: file.type || 'application/octet-stream' };
  }

  if (!referenceFilename && !referenceImage) {
    return NextResponse.json({ error: 'Provide a reference image filename or upload.' }, { status: 400 });
  }
  if (method === 'pixel' && !referenceImage) {
    return NextResponse.json(
      { error: 'Pixel comparison requires an uploaded reference image.' },
      { status: 400 }
    );
  }

  const job = createJob({
    domain: domainResult.domain,
    method,
    threshold,
    maxDepth,
    maxPages,
    parallel,
    referenceFilename: referenceFilename || (referenceImage ? 'reference' : ''),
    referenceImage,
  });

  runCrawl(job.id).catch((err) => {
    job.status = 'error';
    job.error = err instanceof Error ? err.message : 'Unexpected crawl error.';
    notifyJob(job);
  });

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}
