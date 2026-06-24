'use client';

import { useState } from 'react';
import TopBar from '@/components/TopBar';
import SetupScreen, { type SetupState } from '@/components/SetupScreen';
import CrawlScreen from '@/components/CrawlScreen';
import ResultsScreen from '@/components/ResultsScreen';
import { sanitizeDomain } from '@/lib/validate';
import type { Screen, SearchSummary } from '@/components/types';
import type { Snapshot } from '@/components/CrawlScreen';
import type { ResultsResponse } from '@/components/ResultsScreen';

const DEFAULT_SETUP: SetupState = {
  domain: '',
  referenceMode: 'upload',
  file: null,
  previewUrl: null,
  dims: null,
  filenameText: '',
  method: 'pixel',
  threshold: 80,
  maxDepth: 5,
  maxPages: 500,
  parallel: true,
  showAdvanced: false,
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [setup, setSetup] = useState<SetupState>(DEFAULT_SETUP);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<SearchSummary | null>(null);
  const [cachedSnap, setCachedSnap] = useState<Snapshot | null>(null);
  const [cachedResults, setCachedResults] = useState<ResultsResponse | null>(null);

  const updateSetup = <K extends keyof SetupState>(key: K, value: SetupState[K]) => {
    setSetup((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'referenceMode' && value === 'filename') next.method = 'filename';
      return next;
    });
  };

  const handleFileSelected = (file: File) => {
    if (setup.previewUrl) URL.revokeObjectURL(setup.previewUrl);
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setSetup((prev) => (prev.file === file ? { ...prev, dims: { w: img.naturalWidth, h: img.naturalHeight } } : prev));
    };
    img.src = url;
    setSetup((prev) => ({ ...prev, file, previewUrl: url, dims: null }));
  };

  const handleClearFile = () => {
    if (setup.previewUrl) URL.revokeObjectURL(setup.previewUrl);
    setSetup((prev) => ({ ...prev, file: null, previewUrl: null, dims: null }));
  };

  const navigate = (target: Screen) => {
    if (target !== 'setup' && !jobId) return;
    setScreen(target);
  };

  const handleStart = async () => {
    setStartError(null);
    const domainResult = sanitizeDomain(setup.domain);
    if (!domainResult.ok) {
      setStartError(domainResult.error);
      return;
    }
    const referenceFilename = setup.referenceMode === 'upload' ? setup.file?.name ?? '' : setup.filenameText.trim();
    if (!referenceFilename) {
      setStartError('Provide a reference image filename or upload an image.');
      return;
    }
    if (setup.method === 'pixel' && !setup.file) {
      setStartError('Pixel comparison requires an uploaded reference image.');
      return;
    }

    setStarting(true);
    try {
      const form = new FormData();
      form.set('domain', domainResult.domain);
      form.set('method', setup.method);
      form.set('threshold', String(setup.threshold));
      form.set('maxDepth', String(setup.maxDepth));
      form.set('maxPages', String(setup.maxPages));
      form.set('parallel', String(setup.parallel));
      form.set('referenceFilename', referenceFilename);
      if (setup.file) form.set('referenceImage', setup.file);

      const res = await fetch('/api/jobs', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error ?? 'Could not start search.');
        return;
      }
      setJobId(data.jobId);
      setCachedSnap(null);
      setCachedResults(null);
      setActiveSummary({
        domain: domainResult.domain,
        method: setup.method,
        threshold: setup.threshold,
        referenceFilename,
      });
      setScreen('crawl');
    } catch {
      setStartError('Could not reach the server. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const handleNewSearch = () => {
    setJobId(null);
    setActiveSummary(null);
    setCachedSnap(null);
    setCachedResults(null);
    setScreen('setup');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <TopBar screen={screen} hasJob={!!jobId} onNavigate={navigate} />

      {screen === 'setup' && (
        <SetupScreen
          state={setup}
          onChange={updateSetup}
          onFileSelected={handleFileSelected}
          onClearFile={handleClearFile}
          onStart={handleStart}
          starting={starting}
          error={startError}
        />
      )}

      {screen === 'crawl' && jobId && activeSummary && (
        <CrawlScreen
          jobId={jobId}
          summary={activeSummary}
          onViewResults={() => setScreen('results')}
          initialSnap={cachedSnap}
          onSnapUpdate={setCachedSnap}
        />
      )}

      {screen === 'results' && jobId && (
        <ResultsScreen
          jobId={jobId}
          onNewSearch={handleNewSearch}
          initialData={cachedResults}
          onDataFetched={setCachedResults}
        />
      )}
    </div>
  );
}
