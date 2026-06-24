import { getJob } from '@/lib/job-store';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return new Response('Job not found.', { status: 404 });

  const header = 'Time,Status,URL,Note';
  const lines = job.log.map((e) =>
    [e.time, e.dot, e.url, e.note].map(csvEscape).join(',')
  );
  const body = [header, ...lines].join('\n');

  const domain = job.options.domain.replace(/[^a-z0-9.-]/gi, '_');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sift-log-${domain}.csv"`,
    },
  });
}
