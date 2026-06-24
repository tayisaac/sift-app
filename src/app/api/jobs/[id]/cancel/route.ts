import { NextResponse } from 'next/server';
import { getJob, notifyJob } from '@/lib/job-store';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  job.cancelRequested = true;
  notifyJob(job);
  return NextResponse.json({ ok: true });
}
