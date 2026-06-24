'use client';

import { useEffect, useRef, useState } from 'react';
import type { SearchSummary } from './types';

const MONO = 'var(--font-ibm-plex-mono), monospace';

interface ActivityEvent {
  time: string;
  url: string;
  note: string;
  dot: 'match' | 'plain' | 'warn';
}

interface Snapshot {
  status: 'running' | 'done' | 'cancelled' | 'error';
  error: string | null;
  stats: {
    pagesCrawled: number;
    imagesFound: number;
    matchesFound: number;
    currentUrl: string;
    elapsed: string;
  };
  log: ActivityEvent[];
  resultsCount: number;
  maxPages: number;
}

const DOT_COLOR: Record<ActivityEvent['dot'], string> = {
  match: '#1E9E6A',
  plain: '#C4CAD3',
  warn: '#C8901F',
};

const STATUS_LABEL: Record<Snapshot['status'], string> = {
  running: 'Crawling',
  done: 'Complete',
  cancelled: 'Cancelled',
  error: 'Error',
};

export default function CrawlScreen({
  jobId,
  summary,
  onViewResults,
}: {
  jobId: string;
  summary: SearchSummary;
  onViewResults: () => void;
}) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/jobs/${jobId}/events`);
    esRef.current = es;
    es.onmessage = (ev) => {
      const data: Snapshot = JSON.parse(ev.data);
      setSnap(data);
      if (data.status !== 'running') es.close();
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [jobId]);

  const cancel = () => {
    fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' }).catch(() => {});
  };

  const status = snap?.status ?? 'running';
  const stats = snap?.stats ?? {
    pagesCrawled: 0,
    imagesFound: 0,
    matchesFound: 0,
    currentUrl: '',
    elapsed: '0:00',
  };
  const maxPages = snap?.maxPages ?? 1;
  const percent =
    status === 'done'
      ? 100
      : Math.max(0, Math.min(99, Math.round((stats.pagesCrawled / Math.max(1, maxPages)) * 100)));
  const log = snap?.log ?? [];

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 28px 80px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: status === 'running' ? '#2D5BF0' : '#9AA2AE',
                animation: status === 'running' ? 'pulse 1.3s ease-in-out infinite' : 'none',
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: status === 'running' ? '#2D5BF0' : '#8A93A1',
                letterSpacing: '.04em',
                textTransform: 'uppercase',
              }}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 27,
              fontWeight: 800,
              letterSpacing: '-.025em',
              fontFamily: MONO,
            }}
          >
            {summary.domain}
          </h1>
          <p style={{ margin: '7px 0 0', fontSize: 14, color: '#6A7382' }}>
            Looking for <b style={{ color: '#16202E' }}>{summary.referenceFilename}</b> ·{' '}
            {summary.method === 'pixel' ? 'Pixel' : 'Filename'} similarity · ≥ {summary.threshold}%
          </p>
          {snap?.error && <p style={{ margin: '7px 0 0', fontSize: 13, color: '#C8901F' }}>{snap.error}</p>}
        </div>
        {status === 'running' && (
          <button
            onClick={cancel}
            style={{
              border: '1px solid #E0E4EB',
              background: '#fff',
              color: '#5B6573',
              borderRadius: 9,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        )}
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #E6E9EE',
          borderRadius: 14,
          padding: '24px 26px',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 13,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#16202E' }}>Crawling pages</div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: '#6A7382' }}>
            <b style={{ color: '#16202E', fontSize: 15 }}>{stats.pagesCrawled}</b> / {maxPages} pages ·{' '}
            {percent}%
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: '#EDEFF3', overflow: 'hidden' }}>
          <div
            style={{
              width: `${percent}%`,
              height: '100%',
              borderRadius: 6,
              background: 'linear-gradient(90deg,#2D5BF0,#6488F7)',
              backgroundSize: '220px 100%',
              animation: status === 'running' ? 'shimmer 1.1s linear infinite' : 'none',
              transition: 'width .3s',
            }}
          />
        </div>
        {status === 'running' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              marginTop: 14,
              fontSize: 12.5,
              color: '#8A93A1',
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                border: '2px solid #DDE2EA',
                borderTopColor: '#2D5BF0',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin .7s linear infinite',
              }}
            />
            Scanning <span style={{ fontFamily: MONO, color: '#5B6573' }}>{stats.currentUrl || '/'}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Pages crawled', value: stats.pagesCrawled, color: '#16202E', mono: false },
          { label: 'Images found', value: stats.imagesFound, color: '#16202E', mono: false },
          { label: 'Matches so far', value: stats.matchesFound, color: '#1E9E6A', mono: false },
          { label: 'Elapsed', value: stats.elapsed, color: '#16202E', mono: true },
        ].map((card) => (
          <div
            key={card.label}
            style={{ background: '#fff', border: '1px solid #E6E9EE', borderRadius: 13, padding: '18px 20px' }}
          >
            <div style={{ fontSize: 12, color: '#8A93A1', fontWeight: 500 }}>{card.label}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: '-.03em',
                marginTop: 5,
                fontVariantNumeric: 'tabular-nums',
                color: card.color,
                fontFamily: card.mono ? MONO : 'inherit',
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E6E9EE', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #F0F2F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#16202E' }}>Activity log</span>
          {log.length > 0 && (
            <a
              href={`/api/jobs/${jobId}/log`}
              download
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#2D5BF0',
                textDecoration: 'none',
                border: '1px solid #E0E4EB',
                borderRadius: 7,
                padding: '4px 10px',
              }}
            >
              ↓ Download log
            </a>
          )}
        </div>
        <div style={{ maxHeight: 260, overflow: 'auto' }}>
          {log.length === 0 && (
            <div style={{ padding: '22px', fontSize: 12.5, color: '#AEB5BF' }}>Waiting for activity…</div>
          )}
          {log.map((ev, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '11px 22px',
                borderBottom: '1px solid #F4F6F9',
                fontFamily: MONO,
                fontSize: 12.5,
              }}
            >
              <span style={{ color: '#AEB5BF', width: 54, flexShrink: 0 }}>{ev.time}</span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: DOT_COLOR[ev.dot],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: '#5B6573',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {ev.url}
              </span>
              <span style={{ color: '#8A93A1', flexShrink: 0 }}>{ev.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
        <button
          onClick={onViewResults}
          className="lift"
          style={{
            background: '#2D5BF0',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 22px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(45,91,240,.30)',
          }}
        >
          {status === 'running' ? 'View partial results →' : 'View results →'}
        </button>
      </div>
    </main>
  );
}
