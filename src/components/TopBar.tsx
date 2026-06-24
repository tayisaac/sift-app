'use client';

import type { Screen } from './types';

function stepStyle(active: boolean) {
  return {
    chip: active ? '#EDF1FE' : 'transparent',
    dotBg: active ? '#2D5BF0' : '#EDEFF3',
    dotColor: active ? '#fff' : '#9AA2AE',
    text: active ? '#2D5BF0' : '#8A93A1',
  };
}

function Step({
  index,
  label,
  active,
  enabled,
  onClick,
}: {
  index: number;
  label: string;
  active: boolean;
  enabled: boolean;
  onClick: () => void;
}) {
  const s = stepStyle(active);
  return (
    <div
      onClick={enabled ? onClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 9,
        cursor: enabled ? 'pointer' : 'default',
        background: s.chip,
        opacity: enabled ? 1 : 0.55,
      }}
    >
      <div
        style={{
          width: 21,
          height: 21,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11.5,
          fontWeight: 700,
          background: s.dotBg,
          color: s.dotColor,
        }}
      >
        {index}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: s.text }}>{label}</span>
    </div>
  );
}

export default function TopBar({
  screen,
  hasJob,
  onNavigate,
}: {
  screen: Screen;
  hasJob: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(255,255,255,.86)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #E6E9EE',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 28px',
          height: 62,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'linear-gradient(135deg,#2D5BF0,#5B7BF5)',
              position: 'relative',
              boxShadow: '0 3px 10px rgba(45,91,240,.32)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 7,
                top: 7,
                width: 11,
                height: 11,
                borderRadius: 3,
                background: 'rgba(255,255,255,.55)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                width: 11,
                height: 11,
                borderRadius: 3,
                background: '#fff',
              }}
            />
          </div>
          <div style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: '-.02em', color: '#16202E' }}>
            Sift
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: '#8A93A1',
              fontWeight: 500,
              paddingLeft: 11,
              borderLeft: '1px solid #E6E9EE',
            }}
          >
            Image Similarity Finder
          </div>
        </div>

        <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Step index={1} label="Set up" active={screen === 'setup'} enabled onClick={() => onNavigate('setup')} />
          <div style={{ width: 18, height: 1.5, background: '#DDE2EA' }} />
          <Step
            index={2}
            label="Crawl"
            active={screen === 'crawl'}
            enabled={hasJob}
            onClick={() => onNavigate('crawl')}
          />
          <div style={{ width: 18, height: 1.5, background: '#DDE2EA' }} />
          <Step
            index={3}
            label="Results"
            active={screen === 'results'}
            enabled={hasJob}
            onClick={() => onNavigate('results')}
          />
        </nav>
      </div>
    </header>
  );
}
