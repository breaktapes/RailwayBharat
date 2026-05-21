'use client';
import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LiveTrain, LiveTrainsResponse } from '@/types';
import { SearchBar } from '@/components/ui/SearchBar';
import { StaleBar } from '@/components/ui/StaleBar';
import { TrainPopover } from '@/components/map/TrainPopover';

// Map loaded client-side only (WebGL + maplibre require browser APIs)
const LiveMap = dynamic(
  () => import('@/components/map/LiveMap').then((m) => m.LiveMap),
  { ssr: false }
);

async function fetchLiveTrains(): Promise<LiveTrainsResponse> {
  const res = await fetch('/api/trains/live');
  if (!res.ok) throw new Error('Failed to fetch live trains');
  return res.json();
}

export default function MapPage() {
  const [selectedTrain, setSelectedTrain] = useState<LiveTrain | null>(null);
  const [showTracks, setShowTracks] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['trains-live'],
    queryFn: fetchLiveTrains,
  });

  const trains = data?.trains ?? [];
  const stale = data?.stale ?? false;
  const lastUpdated = data?.lastUpdated ?? null;
  const count = data?.count ?? 0;

  const handleTrainClick = useCallback((train: LiveTrain) => {
    setSelectedTrain(train);
  }, []);

  const handleClose = useCallback(() => setSelectedTrain(null), []);

  return (
    <div className="relative h-full w-full" style={{ background: 'var(--bg-base)' }}>
      {/* Stale banner — shown above map when data is stale */}
      <div className="absolute top-0 left-0 right-0 z-30">
        <StaleBar stale={stale} lastUpdated={lastUpdated} queryKey={['trains-live']} />
      </div>

      {/* Live Map */}
      <LiveMap
        trains={trains}
        onTrainClick={handleTrainClick}
        showTracks={showTracks}
      />

      {/* Search bar — floats over map */}
      <div
        className="absolute z-20 left-4 right-4"
        style={{ top: stale ? '40px' : '12px', transition: 'top 0.2s' }}
      >
        <SearchBar />
      </div>

      {/* Train count + track toggle — bottom-left */}
      <div
        className="absolute z-20 left-4 flex items-center gap-2"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        {/* Live count badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'rgba(13,13,26,0.88)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
        >
          {isLoading ? (
            <span style={{ color: 'var(--text-secondary)' }}>Loading…</span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full live-pulse" style={{ background: 'var(--on-time)' }} />
              <span style={{ color: 'var(--text-primary)' }}>{count.toLocaleString()}</span>
              <span style={{ color: 'var(--text-secondary)' }}>trains live</span>
            </>
          )}
        </div>

        {/* Track overlay toggle */}
        <button
          onClick={() => setShowTracks((v) => !v)}
          aria-pressed={showTracks}
          aria-label="Toggle railway track overlay"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{
            background: showTracks ? 'rgba(233,69,96,0.2)' : 'rgba(13,13,26,0.88)',
            border: `1px solid ${showTracks ? 'var(--accent-red)' : 'var(--border)'}`,
            color: showTracks ? 'var(--accent-red)' : 'var(--text-secondary)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 3v18M19 3v18M5 8h14M5 16h14" />
          </svg>
          Tracks
        </button>
      </div>

      {/* Train popover */}
      {selectedTrain && (
        <TrainPopover train={selectedTrain} onClose={handleClose} />
      )}

      {/* Cold start empty state */}
      {!isLoading && trains.length === 0 && !stale && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none"
          style={{ paddingBottom: '80px' }}
        >
          <div
            className="px-6 py-4 rounded-2xl text-center"
            style={{ background: 'rgba(19,19,42,0.9)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Live data loading…</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Check back in ~2 minutes</p>
          </div>
        </div>
      )}
    </div>
  );
}
