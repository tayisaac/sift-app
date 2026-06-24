import { getJob, elapsedLabel } from '@/lib/job-store';
import type { Job } from '@/lib/types';

function snapshot(job: Job) {
  const terminal = job.status !== 'running';
  return {
    status: job.status,
    error: job.error ?? null,
    stats: {
      pagesCrawled: job.stats.pagesCrawled,
      imagesFound: job.stats.imagesFound,
      matchesFound: job.stats.matchesFound,
      currentUrl: job.stats.currentUrl,
      elapsed: elapsedLabel(job),
    },
    log: job.log.slice(-30).reverse(),
    resultsCount: job.results.length,
    maxPages: job.options.maxPages,
    // Include full results only on the terminal event so no extra HTTP fetch is needed.
    results: terminal ? job.results.map((r) => ({
      id: r.id, imageUrl: r.imageUrl, pageUrl: r.pageUrl, method: r.method, score: r.score,
    })) : undefined,
    domain: terminal ? job.options.domain : undefined,
    referenceFilename: terminal ? job.options.referenceFilename : undefined,
    method: terminal ? job.options.method : undefined,
    threshold: terminal ? job.options.threshold : undefined,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return new Response('Job not found.', { status: 404 });

  const encoder = new TextEncoder();
  let listener: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot(job))}\n\n`));
        } catch {
          /* controller already closed */
        }
        if (job.status !== 'running') {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };

      send();
      listener = send;
      job.listeners.add(listener);

      request.signal.addEventListener('abort', () => {
        if (listener) job.listeners.delete(listener);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (listener) job.listeners.delete(listener);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
