import { getJob } from '@/lib/job-store';
import { filterAndSort } from '@/lib/results';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return new Response('Job not found.', { status: 404 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') === 'json' ? 'json' : 'csv';
  const q = (searchParams.get('q') ?? '').trim();
  const sortDir = searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
  const rows = filterAndSort(job.results, q, sortDir);

  if (format === 'json') {
    const body = JSON.stringify(
      rows.map((r) => ({
        imageUrl: r.imageUrl,
        pageUrl: r.pageUrl,
        method: r.method,
        similarity: r.score,
      })),
      null,
      2
    );
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="sift-results.json"',
      },
    });
  }

  const header = 'Image URL,Page URL,Method,Similarity';
  const lines = rows.map(
    (r) => `${csvEscape(r.imageUrl)},${csvEscape(r.pageUrl)},${csvEscape(r.method)},${r.score}`
  );
  const body = [header, ...lines].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="sift-results.csv"',
    },
  });
}
