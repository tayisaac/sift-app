'use client';

import { useRef } from 'react';
import { parseStartUrl } from '@/lib/validate';
import type { Method } from './types';

const MONO = 'var(--font-ibm-plex-mono), monospace';
const ACTIVE = '#2D5BF0';
const IDLE = '#E6E9EE';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface SetupState {
  domain: string;
  referenceMode: 'upload' | 'filename';
  file: File | null;
  previewUrl: string | null;
  dims: { w: number; h: number } | null;
  filenameText: string;
  method: Method;
  threshold: number;
  maxDepth: number;
  maxPages: number;
  parallel: boolean;
  showAdvanced: boolean;
}

export default function SetupScreen({
  state,
  onChange,
  onFileSelected,
  onClearFile,
  onStart,
  starting,
  error,
}: {
  state: SetupState;
  onChange: <K extends keyof SetupState>(key: K, value: SetupState[K]) => void;
  onFileSelected: (file: File) => void;
  onClearFile: () => void;
  onStart: () => void;
  starting: boolean;
  error: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const domainCheck = state.domain ? parseStartUrl(state.domain) : null;
  const referenceName = state.file?.name ?? (state.filenameText || '');
  const canUsePixel = state.referenceMode === 'upload' && !!state.file;
  const methodLabel = state.method === 'pixel' ? 'Pixel' : 'Filename';

  const sectionStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E6E9EE',
    borderRadius: 14,
    padding: '22px 24px',
  };

  const numberLabel: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 600,
    color: '#4A5462',
    display: 'block',
    marginBottom: 6,
  };

  const numberInput: React.CSSProperties = {
    width: '100%',
    border: '1px solid #E0E4EB',
    borderRadius: 8,
    padding: '9px 12px',
    fontFamily: MONO,
    fontSize: 13,
    outline: 'none',
  };

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 28px 80px' }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ margin: '0 0 7px', fontSize: 28, fontWeight: 800, letterSpacing: '-.025em' }}>
          Find every copy of an image across a site
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: '#6A7382', maxWidth: 620, lineHeight: 1.5 }}>
          Point Sift at a domain, give it a reference image, and it will crawl every page to surface
          matching, resized, and renamed assets — ranked by similarity.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 1. Target website */}
          <section style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: ACTIVE,
                  background: '#EDF1FE',
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                1
              </span>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Target website</h2>
            </div>
            <p style={{ margin: '0 0 14px 30px', fontSize: 13, color: '#8A93A1' }}>
              Enter a domain or a URL with a path — Sift will only crawl pages under that path.
            </p>
            <div
              style={{
                marginLeft: 30,
                display: 'flex',
                alignItems: 'stretch',
                border: `1.5px solid ${ACTIVE}`,
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: '0 0 0 3px rgba(45,91,240,.10)',
              }}
            >
              <input
                value={state.domain}
                onChange={(e) => onChange('domain', e.target.value)}
                placeholder="example.com/en/"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  padding: '11px 14px',
                  fontFamily: MONO,
                  fontSize: 14,
                  color: '#16202E',
                  background: '#fff',
                }}
              />
            </div>
            {state.domain && (
              <div
                style={{
                  marginLeft: 30,
                  marginTop: 9,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  color: domainCheck?.ok ? '#1E9E6A' : '#C8901F',
                }}
              >
                <span
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: '50%',
                    background: domainCheck?.ok ? '#E4F5EC' : '#FBF0DE',
                    color: domainCheck?.ok ? '#1E9E6A' : '#C8901F',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {domainCheck?.ok ? '✓' : '!'}
                </span>
                {domainCheck?.ok
                  ? `Crawling: ${domainCheck.displayUrl} · respects robots.txt`
                  : domainCheck?.error}
              </div>
            )}
          </section>

          {/* 2. Reference image */}
          <section style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: ACTIVE,
                  background: '#EDF1FE',
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                2
              </span>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Reference image</h2>
            </div>
            <p style={{ margin: '0 0 12px 30px', fontSize: 13, color: '#8A93A1' }}>
              Upload the image to search for, or enter a filename.
            </p>

            <div style={{ marginLeft: 30, display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['upload', 'filename'] as const).map((mode) => {
                const active = state.referenceMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onChange('referenceMode', mode)}
                    style={{
                      border: `1px solid ${active ? ACTIVE : '#E0E4EB'}`,
                      background: active ? '#EDF1FE' : '#fff',
                      color: active ? ACTIVE : '#5B6573',
                      borderRadius: 7,
                      padding: '5px 11px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {mode === 'upload' ? 'Upload image' : 'Filename only'}
                  </button>
                );
              })}
            </div>

            <div style={{ marginLeft: 30, display: 'flex', gap: 16, alignItems: 'stretch' }}>
              <div style={{ width: 150, flexShrink: 0 }}>
                <div
                  onClick={() => state.referenceMode === 'upload' && fileInputRef.current?.click()}
                  style={{
                    width: 150,
                    height: 96,
                    borderRadius: 11,
                    overflow: 'hidden',
                    border: '1px solid #E6E9EE',
                    background: state.previewUrl
                      ? `#fff url(${state.previewUrl}) center/cover no-repeat`
                      : 'repeating-linear-gradient(135deg,#E8EDF6 0 9px,#EFF2F8 9px 18px)',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-end',
                    cursor: state.referenceMode === 'upload' ? 'pointer' : 'default',
                  }}
                >
                  {state.dims && (
                    <div
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: 'linear-gradient(transparent,rgba(20,32,60,.55))',
                        fontFamily: MONO,
                        fontSize: 9.5,
                        color: '#fff',
                      }}
                    >
                      {state.dims.w} × {state.dims.h}
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFileSelected(f);
                    e.target.value = '';
                  }}
                />
                {state.referenceMode === 'upload' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        flex: 1,
                        border: '1px solid #E0E4EB',
                        background: '#fff',
                        borderRadius: 7,
                        padding: 5,
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: '#4A5462',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {state.file ? 'Replace' : 'Upload'}
                    </button>
                    {state.file && (
                      <button
                        onClick={onClearFile}
                        style={{
                          border: '1px solid #E0E4EB',
                          background: '#fff',
                          borderRadius: 7,
                          padding: '5px 9px',
                          fontSize: 11.5,
                          color: '#9AA2AE',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {state.referenceMode === 'upload' ? (
                  <>
                    <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 500, color: '#16202E' }}>
                      {state.file?.name ?? 'No file selected'}
                    </div>
                    <div style={{ fontSize: 12, color: '#8A93A1', marginTop: 3 }}>
                      {state.file
                        ? `${state.file.type.split('/')[1]?.toUpperCase() ?? 'FILE'} · ${formatBytes(
                            state.file.size
                          )} · uploaded`
                        : 'JPEG, PNG, WebP, GIF, or SVG'}
                    </div>
                  </>
                ) : (
                  <>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: '#4A5462', marginBottom: 6 }}>
                      Target filename
                    </label>
                    <input
                      value={state.filenameText}
                      onChange={(e) => onChange('filenameText', e.target.value)}
                      placeholder="hero-banner.jpg"
                      style={{
                        border: '1px solid #E0E4EB',
                        borderRadius: 8,
                        padding: '9px 12px',
                        fontFamily: MONO,
                        fontSize: 13,
                        outline: 'none',
                        marginTop: 6,
                      }}
                    />
                  </>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 13 }}>
                  {['JPEG', 'PNG', 'WebP', 'GIF', 'SVG'].map((fmt) => (
                    <span
                      key={fmt}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: '#6A7382',
                        background: '#F2F4F8',
                        borderRadius: 6,
                        padding: '3px 8px',
                      }}
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 3. Comparison method */}
          <section style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: ACTIVE,
                  background: '#EDF1FE',
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                3
              </span>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Comparison method</h2>
            </div>
            <p style={{ margin: '0 0 14px 30px', fontSize: 13, color: '#8A93A1' }}>
              How Sift decides whether an asset matches your reference.
            </p>
            <div style={{ marginLeft: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {(
                [
                  {
                    key: 'filename' as const,
                    title: 'Filename',
                    desc: 'Matches the filename and path using string similarity (Jaccard / Levenshtein).',
                    best: 'assets follow a consistent naming convention.',
                    disabled: false,
                  },
                  {
                    key: 'pixel' as const,
                    title: 'Pixel',
                    desc: 'Compares visual content using sliding-window template matching.',
                    best: 'images are cropped, repositioned, or appear as part of a larger image.',
                    disabled: !canUsePixel,
                  },
                ] as const
              ).map((card) => {
                const selected = state.method === card.key;
                const border = selected ? ACTIVE : IDLE;
                const bg = selected ? '#F6F9FF' : '#fff';
                return (
                  <div
                    key={card.key}
                    onClick={() => !card.disabled && onChange('method', card.key)}
                    className={card.disabled ? '' : 'lift'}
                    style={{
                      cursor: card.disabled ? 'not-allowed' : 'pointer',
                      border: `1.5px solid ${border}`,
                      background: bg,
                      borderRadius: 12,
                      padding: '15px 16px',
                      opacity: card.disabled ? 0.5 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 7,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{card.title}</span>
                      <span
                        style={{
                          width: 17,
                          height: 17,
                          borderRadius: '50%',
                          border: `1.5px solid ${selected ? ACTIVE : '#CBD2DC'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: selected ? ACTIVE : 'transparent',
                          }}
                        />
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: '#6A7382' }}>{card.desc}</p>
                    <div style={{ marginTop: 9, fontSize: 11, color: '#9AA2AE', lineHeight: 1.4 }}>
                      <b style={{ color: '#7B8492' }}>Best when</b> {card.best}
                    </div>
                    {card.disabled && (
                      <div style={{ marginTop: 7, fontSize: 10.5, color: '#C8901F' }}>
                        Upload an image to enable pixel comparison.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. Threshold */}
          <section style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: ACTIVE,
                  background: '#EDF1FE',
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                4
              </span>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Similarity threshold</h2>
            </div>
            <p style={{ margin: '0 0 16px 30px', fontSize: 13, color: '#8A93A1' }}>
              Only assets scoring at or above this value are returned.
            </p>
            <div style={{ marginLeft: 30 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 34,
                    fontWeight: 800,
                    letterSpacing: '-.03em',
                    color: ACTIVE,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {state.threshold}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: ACTIVE }}>%</span>
                <span style={{ fontSize: 12.5, color: '#9AA2AE', marginLeft: 6 }}>minimum match</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={state.threshold}
                onChange={(e) => onChange('threshold', Number(e.target.value))}
                style={{ width: '100%', height: 6, cursor: 'pointer' }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 7,
                  fontFamily: MONO,
                  fontSize: 11,
                  color: '#AEB5BF',
                }}
              >
                <span>0% · loose</span>
                <span>50%</span>
                <span>100% · exact</span>
              </div>
            </div>
          </section>

          {/* Advanced */}
          <section style={{ ...sectionStyle, padding: 0, overflow: 'hidden' }}>
            <div
              onClick={() => onChange('showAdvanced', !state.showAdvanced)}
              style={{
                cursor: 'pointer',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#4A5462' }}>
                  Advanced crawl settings
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    color: '#9AA2AE',
                    background: '#F2F4F8',
                    borderRadius: 6,
                    padding: '2px 8px',
                  }}
                >
                  optional
                </span>
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: '#9AA2AE',
                  transform: state.showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform .2s',
                  display: 'inline-block',
                }}
              >
                ▾
              </span>
            </div>
            {state.showAdvanced && (
              <div style={{ padding: '4px 24px 22px', borderTop: '1px solid #F0F2F6' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                  <div>
                    <label style={numberLabel}>Max crawl depth</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={state.maxDepth}
                      onChange={(e) => onChange('maxDepth', Number(e.target.value))}
                      style={numberInput}
                    />
                  </div>
                  <div>
                    <label style={numberLabel}>Max pages</label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={state.maxPages}
                      onChange={(e) => onChange('maxPages', Number(e.target.value))}
                      style={numberInput}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 16,
                    paddingTop: 15,
                    borderTop: '1px solid #F0F2F6',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#4A5462' }}>Parallel crawling</div>
                    <div style={{ fontSize: 11.5, color: '#9AA2AE', marginTop: 2 }}>
                      Fetch multiple pages at once for faster runs.
                    </div>
                  </div>
                  <div
                    onClick={() => onChange('parallel', !state.parallel)}
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 13,
                      background: state.parallel ? ACTIVE : '#D7DCE4',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: state.parallel ? 20 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                        transition: 'left .15s',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: summary */}
        <aside
          style={{
            position: 'sticky',
            top: 84,
            background: '#fff',
            border: '1px solid #E6E9EE',
            borderRadius: 14,
            padding: '22px 22px 24px',
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#16202E' }}>
            Search summary
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: '#8A93A1' }}>Start URL</span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 500, color: '#16202E' }}>
                {domainCheck?.ok ? domainCheck.displayUrl : (state.domain || '—')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: '#8A93A1' }}>Reference</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#16202E',
                  textAlign: 'right',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 180,
                }}
              >
                {referenceName || '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: '#8A93A1' }}>Method</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: ACTIVE,
                  background: '#EDF1FE',
                  borderRadius: 6,
                  padding: '3px 9px',
                }}
              >
                {methodLabel}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: '#8A93A1' }}>Threshold</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16202E' }}>≥ {state.threshold}%</span>
            </div>
          </div>
          {error && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: '#C8901F', lineHeight: 1.4 }}>{error}</div>
          )}
          <button
            onClick={onStart}
            disabled={starting}
            className="lift"
            style={{
              width: '100%',
              marginTop: 20,
              background: ACTIVE,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: 13,
              fontSize: 14.5,
              fontWeight: 700,
              cursor: starting ? 'default' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(45,91,240,.30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: starting ? 0.7 : 1,
            }}
          >
            {starting ? 'Starting…' : 'Start search →'}
          </button>
          <div
            style={{
              marginTop: 16,
              paddingTop: 15,
              borderTop: '1px solid #F0F2F6',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#8A93A1' }}>
              <span style={{ color: '#1E9E6A' }}>●</span> All requests over TLS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#8A93A1' }}>
              <span style={{ color: '#1E9E6A' }}>●</span> Images discarded after session
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#8A93A1' }}>
              <span style={{ color: '#1E9E6A' }}>●</span> Failed fetches retried 3×
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
