'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Method } from './types';

const MONO = 'var(--font-ibm-plex-mono), monospace';

interface ResultRow {
  id: number;
  imageUrl: string;
  pageUrl: string;
  method: Method;
  score: number;
}

export type { ResultRow };

export interface ResultsResponse {
  rows: ResultRow[];
  total: number;
  page: number;
  pageSize: number;
  domain: string;
  method: Method;
  threshold: number;
  referenceFilename: string;
  pagesCrawled: number;
  totalMatches: number;
  matchedPages: number;
}

function barColorFor(score: number): string {
  if (score >= 90) return '#1E9E6A';
  if (score >= 80) return '#2D5BF0';
  return '#C8901F';
}

function Thumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #E6E9EE',
        background: '#EFF2F8',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(135deg,#E8EDF6 0 5px,#EFF2F8 5px 10px)',
          }}
        />
      )}
    </div>
  );
}

export default function ResultsScreen({
  jobId,
  onNewSearch,
  allRows,
  summary,
}: {
  jobId: string;
  onNewSearch: () => void;
  allRows?: ResultRow[] | null;
  summary?: { domain: string; method: string; threshold: number; referenceFilename: string } | null;
}) {
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!allRows);
  const [jobDone, setJobDone] = useState(!!allRows);
  const pageSize = 9;

  // When all rows are cached client-side, filter/sort/paginate without server calls.
  const clientFiltered = useMemo(() => {
    if (!allRows) return null;
    const needle = debouncedQuery.toLowerCase();
    const filtered = needle
      ? allRows.filter((r) => r.imageUrl.toLowerCase().includes(needle) || r.pageUrl.toLowerCase().includes(needle))
      : allRows;
    return [...filtered].sort((a, b) => sortDir === 'desc' ? b.score - a.score : a.score - b.score);
  }, [allRows, debouncedQuery, sortDir]);

  const clientPageRows = useMemo(() => {
    if (!clientFiltered) return null;
    return clientFiltered.slice((page - 1) * pageSize, page * pageSize);
  }, [clientFiltered, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (allRows) return; // have full data client-side, skip server fetch

    let cancelled = false;

    const params = new URLSearchParams({
      sort: sortDir,
      q: debouncedQuery,
      page: String(page),
      pageSize: String(pageSize),
    });
    fetch(`/api/jobs/${jobId}/results?${params.toString()}`)
      .then((r) => r.json())
      .then((d: ResultsResponse) => { if (!cancelled && d.rows) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });

    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((d: { status: string }) => { if (!cancelled && d.status !== 'running') setJobDone(true); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [jobId, sortDir, debouncedQuery, page, allRows]);

  // Poll for new results every 2s while crawl is in progress (server-side path only).
  useEffect(() => {
    if (jobDone || allRows) return;
    const interval = setInterval(() => {
      const params = new URLSearchParams({
        sort: sortDir,
        q: debouncedQuery,
        page: String(page),
        pageSize: String(pageSize),
      });
      Promise.all([
        fetch(`/api/jobs/${jobId}/results?${params.toString()}`).then((r) => r.json()),
        fetch(`/api/jobs/${jobId}`).then((r) => r.json()),
      ]).then(([results, status]: [ResultsResponse, { status: string }]) => {
        if (results.rows) setData(results);
        if (status.status !== 'running') {
          setJobDone(true);
          clearInterval(interval);
        }
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId, jobDone, allRows, sortDir, debouncedQuery, page]);

  const toggleSort = () => {
    setLoading(true);
    setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
  };

  const goToPage = (p: number) => {
    setLoading(true);
    setPage(p);
  };

  const exportAs = (format: 'csv' | 'json') => {
    const exportRows = clientFiltered ?? allRows;
    if (exportRows) {
      const domain = data?.domain ?? jobId;
      const blob =
        format === 'json'
          ? new Blob(
              [JSON.stringify(exportRows.map((r) => ({ imageUrl: r.imageUrl, pageUrl: r.pageUrl, method: r.method, similarity: r.score })), null, 2)],
              { type: 'application/json' }
            )
          : (() => {
              const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
              const lines = exportRows.map((r) => [r.imageUrl, r.pageUrl, r.method, String(r.score)].map(esc).join(','));
              return new Blob([['Image URL,Page URL,Method,Similarity', ...lines].join('\n')], { type: 'text/csv' });
            })();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sift-results-${domain}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    // Fallback: let the server generate it (live crawl, prefetch not yet complete).
    const params = new URLSearchParams({ format, sort: sortDir, q: debouncedQuery });
    const a = document.createElement('a');
    a.href = `/api/jobs/${jobId}/export?${params.toString()}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const rows = clientPageRows ?? data?.rows ?? [];
  const total = clientFiltered ? clientFiltered.length : (data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const pageButtons: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pageButtons.push(p);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    border: `1px solid ${active ? '#2D5BF0' : '#E0E4EB'}`,
    background: active ? '#2D5BF0' : '#fff',
    borderRadius: 7,
    padding: '6px 11px',
    fontSize: 12.5,
    color: active ? '#fff' : '#5B6573',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
  });

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 28px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 74,
            height: 50,
            borderRadius: 9,
            overflow: 'hidden',
            border: '1px solid #E6E9EE',
            flexShrink: 0,
            background: 'repeating-linear-gradient(135deg,#E8EDF6 0 8px,#EFF2F8 8px 16px)',
          }}
        />
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-.025em' }}>
            {allRows
              ? `${allRows.length} matching image${allRows.length === 1 ? '' : 's'}`
              : data ? `${data.totalMatches} matching image${data.totalMatches === 1 ? '' : 's'}` : '…'}
          </h1>
          {(data || summary) && (() => {
            const domain = data?.domain ?? summary?.domain ?? '';
            const ref = data?.referenceFilename ?? summary?.referenceFilename ?? '';
            const method = data?.method ?? summary?.method ?? '';
            const threshold = data?.threshold ?? summary?.threshold ?? 0;
            const matchedPages = allRows ? new Set(allRows.map((r) => r.pageUrl)).size : (data?.matchedPages ?? 0);
            return (
              <p style={{ margin: '5px 0 0', fontSize: 13.5, color: '#6A7382' }}>
                across <b style={{ color: '#16202E' }}>{matchedPages} pages</b> of{' '}
                <span style={{ fontFamily: MONO }}>{domain}</span> · for{' '}
                <span style={{ fontFamily: MONO }}>{ref}</span> ·{' '}
                {method === 'pixel' ? 'Pixel' : method === 'hash' ? 'Hash' : 'Filename'} · ≥ {threshold}%
              </p>
            );
          })()}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => exportAs('csv')} className="lift" style={exportBtnStyle}>
            ↓ CSV
          </button>
          <button onClick={() => exportAs('json')} className="lift" style={exportBtnStyle}>
            ↓ JSON
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 220,
            maxWidth: 320,
            border: '1px solid #E0E4EB',
            background: '#fff',
            borderRadius: 9,
            padding: '8px 12px',
          }}
        >
          <span style={{ color: '#AEB5BF', fontSize: 14 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by URL…"
            style={{
              border: 'none',
              outline: 'none',
              flex: 1,
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#16202E',
              background: 'transparent',
            }}
          />
        </div>
        {(data || summary) && (() => {
          const method = data?.method ?? summary?.method ?? '';
          const threshold = data?.threshold ?? summary?.threshold ?? 0;
          return (
            <>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#2D5BF0', background: '#EDF1FE', borderRadius: 7, padding: '6px 11px' }}>
                {method === 'pixel' ? 'Pixel' : method === 'hash' ? 'Hash' : 'Filename'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5B6573', background: '#F2F4F8', borderRadius: 7, padding: '6px 11px' }}>
                ≥ {threshold}%
              </span>
            </>
          );
        })()}
        <div style={{ marginLeft: 'auto', fontSize: 12.5, color: '#8A93A1' }}>
          Showing <b style={{ color: '#16202E' }}>{start}–{end}</b> of {total}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E6E9EE', borderRadius: 14, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1.4fr 1.6fr 92px 150px',
            alignItems: 'center',
            gap: 14,
            padding: '12px 20px',
            borderBottom: '1px solid #EDEFF3',
            background: '#FAFBFD',
            fontSize: 11,
            fontWeight: 700,
            color: '#8A93A1',
            textTransform: 'uppercase',
            letterSpacing: '.05em',
          }}
        >
          <div>Image</div>
          <div>Image URL</div>
          <div>Page URL</div>
          <div>Method</div>
          <div
            onClick={toggleSort}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 5,
              color: '#2D5BF0',
            }}
          >
            Similarity <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
          </div>
        </div>

        {!loading && rows.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#8A93A1' }}>
            No matching images{debouncedQuery ? ' for this filter' : ' yet'}.
          </div>
        )}

        {rows.map((r) => (
          <div
            key={r.id}
            className="row-hover"
            style={{
              display: 'grid',
              gridTemplateColumns: '64px 1.4fr 1.6fr 92px 150px',
              alignItems: 'center',
              gap: 14,
              padding: '13px 20px',
              borderBottom: '1px solid #F4F6F9',
            }}
          >
            <Thumb src={r.imageUrl} />
            <div
              style={{
                fontFamily: MONO,
                fontSize: 12.5,
                color: '#16202E',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={r.imageUrl}
            >
              {r.imageUrl}
            </div>
            <a
              href={r.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={r.pageUrl}
              style={{
                fontFamily: MONO,
                fontSize: 12.5,
                color: '#2D5BF0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textDecoration: 'none',
                display: 'block',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              {r.pageUrl}
            </a>
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#5B6573',
                  background: '#F2F4F8',
                  borderRadius: 6,
                  padding: '3px 9px',
                }}
              >
                {r.method === 'pixel' ? 'Pixel' : r.method === 'hash' ? 'Hash' : 'Filename'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <div style={{ width: 58, height: 6, borderRadius: 4, background: '#EDEFF3', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 4,
                    width: `${r.score}%`,
                    background: barColorFor(r.score),
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 600,
                  color: barColorFor(r.score),
                  width: 38,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.score}%
              </span>
            </div>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: '#FAFBFD',
          }}
        >
          <span style={{ fontSize: 12.5, color: '#8A93A1' }}>
            {rows.length} of {total} matches
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              style={{ ...btnStyle(false), color: page <= 1 ? '#AEB5BF' : '#5B6573', cursor: page <= 1 ? 'default' : 'pointer' }}
            >
              ‹ Prev
            </button>
            {pageButtons.map((p) => (
              <button key={p} onClick={() => goToPage(p)} style={btnStyle(p === page)}>
                {p}
              </button>
            ))}
            <button
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              style={{
                ...btnStyle(false),
                color: page >= totalPages ? '#AEB5BF' : '#5B6573',
                cursor: page >= totalPages ? 'default' : 'pointer',
              }}
            >
              Next ›
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }}>
        <button
          onClick={onNewSearch}
          style={{
            border: '1px solid #E0E4EB',
            background: '#fff',
            color: '#5B6573',
            borderRadius: 10,
            padding: '11px 22px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ＋ New search
        </button>
      </div>
    </main>
  );
}

const exportBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  border: '1px solid #E0E4EB',
  background: '#fff',
  color: '#4A5462',
  borderRadius: 9,
  padding: '9px 15px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
