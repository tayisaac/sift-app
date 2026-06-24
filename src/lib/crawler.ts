import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { getJob, notifyJob, pushLog, elapsedLabel } from './job-store';
import { computeRefPixels, computeCandPixels, slideNCC, filenameSimilarity } from './similarity';
import type { Job, ResultRow } from './types';

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = 'SiftBot/1.0 (+image-similarity-finder)';

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }
}

function pathOf(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return (u.pathname || '/') + (u.search || '');
  } catch {
    return urlStr;
  }
}

function resolveSrcsetFirst(srcset: string, base: string): string | null {
  const first = srcset.split(',')[0]?.trim().split(/\s+/)[0];
  if (!first) return null;
  try {
    return new URL(first, base).toString();
  } catch {
    return null;
  }
}

const BG_IMAGE_RE = /background(?:-image)?\s*:[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
const IMG_EXT_RE = /\.(png|jpe?g|webp|gif|svg)(\?[^"'\s]*)?$/i;

/** Recursively collect all string leaf values from a JSON object. */
function collectStrings(value: unknown, out: string[]) {
  if (typeof value === 'string') { out.push(value); return; }
  if (Array.isArray(value)) { for (const v of value) collectStrings(v, out); return; }
  if (value && typeof value === 'object') { for (const v of Object.values(value)) collectStrings(v, out); }
}

function extractImageUrls($: cheerio.CheerioAPI, pageUrl: string): string[] {
  const urls = new Set<string>();
  const add = (raw: string | undefined | null, base = pageUrl) => {
    if (!raw) return;
    try {
      const abs = new URL(raw, base);
      if (abs.protocol === 'http:' || abs.protocol === 'https:') urls.add(abs.toString());
    } catch {
      /* ignore malformed URLs */
    }
  };

  $('img').each((_, el) => {
    add($(el).attr('src'));
    const srcset = $(el).attr('srcset');
    if (srcset) add(resolveSrcsetFirst(srcset, pageUrl));
  });
  $('source').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) add(resolveSrcsetFirst(srcset, pageUrl));
  });
  $('meta[property="og:image"], meta[property="og:image:url"]').each((_, el) => {
    add($(el).attr('content'));
  });
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') ?? '';
    for (const m of style.matchAll(BG_IMAGE_RE)) add(m[1]);
  });
  $('style').each((_, el) => {
    const css = $(el).text();
    for (const m of css.matchAll(BG_IMAGE_RE)) add(m[1]);
  });

  // Extract images embedded in __NEXT_DATA__ (JS-rendered Next.js sites).
  const nextDataEl = $('script#__NEXT_DATA__');
  if (nextDataEl.length) {
    try {
      const json = JSON.parse(nextDataEl.text());
      // Collect runtimeConfig base URLs (e.g. CMS CDN origins) to resolve relative paths.
      const configBases: string[] = [];
      if (json?.runtimeConfig && typeof json.runtimeConfig === 'object') {
        for (const v of Object.values(json.runtimeConfig)) {
          if (typeof v === 'string' && /^https?:\/\//i.test(v)) configBases.push(v);
        }
      }
      const strings: string[] = [];
      collectStrings(json, strings);
      for (const s of strings) {
        if (!IMG_EXT_RE.test(s)) continue;
        if (s.includes('{')) continue; // skip template placeholders like {cropName}/{width}
        if (/^https?:\/\//i.test(s)) {
          add(s);
        } else if (s.startsWith('/')) {
          // Try each runtimeConfig base first, then fall back to page origin.
          let resolved = false;
          for (const base of configBases) {
            try {
              // Concatenate rather than using new URL(path, base) so the base's
              // path prefix (e.g. /cms) is preserved instead of being replaced.
              const candidate = base.replace(/\/$/, '') + s;
              new URL(candidate); // validate
              urls.add(candidate);
              resolved = true;
            } catch { /* skip */ }
          }
          if (!resolved) add(s); // resolve against page URL as last resort
        }
      }
    } catch {
      /* malformed JSON, skip */
    }
  }

  return [...urls];
}

async function scoreImagePixel(job: Job, imgUrl: string): Promise<number> {
  if (job.referencePixels == null) return -1;
  try {
    const res = await fetchWithTimeout(imgUrl, FETCH_TIMEOUT_MS);
    if (!res.ok) return -1;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType || !contentType.startsWith('image/')) return -1;
    const buf = Buffer.from(await res.arrayBuffer());
    const candPixels = await computeCandPixels(buf);
    return slideNCC(job.referencePixels, candPixels);
  } catch {
    return -1;
  }
}

export async function runCrawl(jobId: string): Promise<void> {
  const maybeJob = getJob(jobId);
  if (!maybeJob) return;
  const job: Job = maybeJob;
  const { domain, rootUrl, pathPrefix, maxDepth, maxPages, parallel, referenceImage, referenceFilename, method, threshold } =
    job.options;

  const underPrefix = (pathname: string): boolean =>
    pathPrefix === '' || pathname === pathPrefix || pathname.startsWith(pathPrefix + '/');

  if (method === 'pixel') {
    if (!referenceImage) {
      job.status = 'error';
      job.error = 'Pixel comparison requires an uploaded reference image.';
      notifyJob(job);
      return;
    }
    try {
      job.referencePixels = await computeRefPixels(referenceImage.buffer);
    } catch {
      job.status = 'error';
      job.error = 'Could not process the reference image.';
      notifyJob(job);
      return;
    }
  }

  let robots: ReturnType<typeof robotsParser> | null = null;
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const res = await fetchWithTimeout(robotsUrl, FETCH_TIMEOUT_MS);
    if (res.ok) {
      const txt = await res.text();
      robots = robotsParser(robotsUrl, txt);
    }
  } catch {
    /* no robots.txt available; proceed allowing all */
  }

  const visited = new Set<string>([rootUrl]);
  const queue: { url: string; depth: number }[] = [{ url: rootUrl, depth: 0 }];

  // Seed queue from sitemap(s) so JS-rendered sites (no <a> tags) are fully crawled.
  async function loadSitemap(sitemapUrl: string, depth = 0) {
    if (depth > 2) return; // guard against deeply nested sitemap indexes
    try {
      const res = await fetchWithTimeout(sitemapUrl, FETCH_TIMEOUT_MS);
      if (!res.ok) return;
      const xml = await res.text();
      // Handle sitemap indexes: recurse into nested sitemaps
      const nestedSitemaps = [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
      for (const nested of nestedSitemaps) await loadSitemap(nested, depth + 1);
      // Extract page URLs
      const locs = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
      for (const loc of locs) {
        try {
          const u = new URL(loc);
          if (u.hostname !== new URL(rootUrl).hostname) continue;
          if (!underPrefix(u.pathname)) continue;
          u.hash = '';
          const key = u.toString();
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ url: key, depth: 1 });
          }
        } catch { /* skip malformed */ }
      }
    } catch { /* sitemap unavailable */ }
  }

  // Try sitemap advertised in robots.txt first, fall back to /sitemap.xml
  const robotsSitemap = robots?.getSitemaps?.()?.[0];
  await loadSitemap(robotsSitemap ?? `https://${domain}/sitemap.xml`);

  let active = 0;
  let resultIdCounter = 1;
  const concurrency = parallel ? 5 : 1;

  await new Promise<void>((resolve) => {
    const finish = (status: Job['status']) => {
      if (job.status === 'running') {
        job.status = status;
        notifyJob(job);
      }
      resolve();
    };

    const pump = () => {
      if (job.cancelRequested) {
        finish('cancelled');
        return;
      }
      if (queue.length === 0 && active === 0) {
        finish('done');
        return;
      }
      while (
        active < concurrency &&
        queue.length > 0 &&
        job.stats.pagesCrawled + active < maxPages &&
        !job.cancelRequested
      ) {
        const item = queue.shift()!;
        active++;
        processPage(item)
          .catch(() => {})
          .finally(() => {
            active--;
            pump();
          });
      }
      if (active === 0) finish('done');
    };

    async function processPage({ url, depth }: { url: string; depth: number }) {
      if (job.cancelRequested) return;
      if (robots && !robots.isAllowed(url, USER_AGENT)) return;

      job.stats.currentUrl = pathOf(url);
      notifyJob(job);

      let html: string | null = null;
      let retries = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
          if (!res.ok) throw new Error(String(res.status));
          const ct = res.headers.get('content-type') ?? '';
          if (!ct.includes('text/html')) return;
          html = await res.text();
          break;
        } catch {
          retries++;
          if (attempt === 2) {
            pushLog(job, { time: elapsedLabel(job), url: pathOf(url), note: 'fetch failed', dot: 'warn' });
            notifyJob(job);
            return;
          }
        }
      }
      if (html == null || job.cancelRequested) return;

      job.stats.pagesCrawled++;

      const $ = cheerio.load(html);
      let hostname: string;
      try {
        hostname = new URL(url).hostname;
      } catch {
        hostname = domain;
      }

      if (depth < maxDepth) {
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          try {
            const abs = new URL(href, url);
            abs.hash = '';
            if (abs.hostname !== hostname) return;
            if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
            if (!underPrefix(abs.pathname)) return;
            const key = abs.toString();
            if (visited.has(key)) return;
            visited.add(key);
            queue.push({ url: key, depth: depth + 1 });
          } catch {
            /* skip malformed link */
          }
        });
      }

      const imageUrls = extractImageUrls($, url);
      let pageMatchCount = 0;

      for (const imgUrl of imageUrls) {
        if (job.seenImages.has(imgUrl)) {
          const existing = job.seenImages.get(imgUrl);
          if (existing) {
            const pages = job.seenPagesForImage.get(imgUrl)!;
            if (!pages.has(url)) {
              pages.add(url);
              job.results.push({ ...existing, id: resultIdCounter++, pageUrl: url });
              job.stats.matchesFound++;
              pageMatchCount++;
            }
          }
          continue;
        }

        job.stats.imagesFound++;
        let score: number;
        if (method === 'filename') {
          score = filenameSimilarity(referenceFilename, imgUrl);
        } else {
          score = await scoreImagePixel(job, imgUrl);
          if (score < 0) {
            job.seenImages.set(imgUrl, null);
            job.seenPagesForImage.set(imgUrl, new Set([url]));
            continue;
          }
        }

        if (score >= threshold) {
          const row: ResultRow = { id: resultIdCounter++, imageUrl: imgUrl, pageUrl: url, method, score };
          job.seenImages.set(imgUrl, row);
          job.seenPagesForImage.set(imgUrl, new Set([url]));
          job.results.push(row);
          job.stats.matchesFound++;
          pageMatchCount++;
        } else {
          job.seenImages.set(imgUrl, null);
          job.seenPagesForImage.set(imgUrl, new Set([url]));
        }
      }

      const noteParts = [`${imageUrls.length} img${imageUrls.length === 1 ? '' : 's'}`];
      if (pageMatchCount > 0) noteParts.push(`${pageMatchCount} match${pageMatchCount === 1 ? '' : 'es'}`);
      if (retries > 0) noteParts.push(`retry ${retries}`);
      pushLog(job, {
        time: elapsedLabel(job),
        url: pathOf(url),
        note: noteParts.join(' · '),
        dot: pageMatchCount > 0 ? 'match' : retries > 0 ? 'warn' : 'plain',
      });
      notifyJob(job);
    }

    pump();
  });
}
