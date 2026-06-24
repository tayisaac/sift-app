export type Method = 'filename' | 'pixel';

export type JobStatus = 'running' | 'done' | 'cancelled' | 'error';

export interface JobOptions {
  domain: string; // hostname, e.g. "example.com"
  method: Method;
  threshold: number; // 0-100
  maxDepth: number;
  maxPages: number;
  parallel: boolean;
  referenceFilename: string;
  referenceImage: { buffer: Buffer; mimeType: string } | null;
}

export interface ResultRow {
  id: number;
  imageUrl: string;
  pageUrl: string;
  method: Method;
  score: number;
}

export type ActivityDot = 'match' | 'plain' | 'warn';

export interface ActivityEvent {
  time: string; // mm:ss elapsed
  url: string;
  note: string;
  dot: ActivityDot;
}

export interface JobStats {
  pagesCrawled: number;
  imagesFound: number;
  matchesFound: number;
  currentUrl: string;
  startedAt: number;
}

export interface Job {
  id: string;
  options: JobOptions;
  status: JobStatus;
  error?: string;
  stats: JobStats;
  log: ActivityEvent[];
  results: ResultRow[];
  cancelRequested: boolean;
  referencePixels: Float32Array | null;
  seenImages: Map<string, ResultRow | null>; // imageUrl -> matched row template (null if below threshold)
  seenPagesForImage: Map<string, Set<string>>; // imageUrl -> set of pageUrls already recorded
  listeners: Set<(event: { type: string }) => void>;
}
