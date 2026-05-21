'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DelayBadge } from '@/components/ui/DelayBadge';
import { SkeletonRow } from '@/components/ui/SkeletonCard';
import { StaleBar } from '@/components/ui/StaleBar';
import type { StationBoard, StationBoardEntry } from '@/types';

interface StationBoardResponse extends StationBoard {
  stale?: boolean;
}

async function fetchStation(code: string): Promise<StationBoardResponse> {
  const res = await fetch(`/api/station/${code}`);
  if (!res.ok) throw new Error('Station data unavailable');
  return res.json();
}

function DelayDot({ minutes }: { minutes: number }) {
  const color =
    minutes <= 0 ? 'var(--on-time)' : minutes < 30 ? 'var(--delayed-mild)' : 'var(--delayed-severe)';
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />;
}

function TrainRow({ entry }: { entry: StationBoardEntry }) {
  const isCancelled = entry.status === 'cancelled';
  const dep = entry.actualDep ?? entry.scheduledDep;
  const isDelayed = entry.actualDep && entry.actualDep !== entry.scheduledDep && entry.delayMinutes > 0;

  return (
    <Link
      href={`/train/${entry.trainNumber}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 active:bg-white/8"
      style={{ borderBottom: '1px solid var(--border)', opacity: isCancelled ? 0.5 : 1 }}
    >
      {/* Status dot */}
      <DelayDot minutes={isCancelled ? 9999 : entry.delayMinutes} />

      {/* Train info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {entry.trainName}
          </span>
          {isCancelled && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--delayed-severe)' }}>
              CNCL
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-mono">{entry.trainNumber}</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span className="truncate">{entry.destination}</span>
        </div>
      </div>

      {/* Time + platform */}
      <div className="text-right shrink-0">
        <p
          className="font-mono text-sm font-semibold"
          style={{ color: isDelayed ? 'var(--delayed-mild)' : 'var(--text-primary)' }}
        >
          {dep}
        </p>
        {isDelayed && (
          <p className="font-mono text-[10px]" style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
            {entry.scheduledDep}
          </p>
        )}
        {entry.platform && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {entry.platform}
          </p>
        )}
        {entry.delayMinutes > 0 && !isCancelled && (
          <DelayBadge minutes={entry.delayMinutes} size="sm" />
        )}
      </div>

      {/* Chevron */}
      <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="9,18 15,12 9,6" />
      </svg>
    </Link>
  );
}

export default function StationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const stationCode = code.toUpperCase();
  const [tab, setTab] = useState<'dep' | 'arr'>('dep');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['station', stationCode],
    queryFn: () => fetchStation(stationCode),
    refetchInterval: 60_000,
  });

  const trains = data?.trains ?? [];
  const empty = !isLoading && !isError && trains.length === 0;

  return (
    <div className="h-full overflow-y-auto" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(13,13,26,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <Link href="/stations" aria-label="Back to stations" className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="skeleton h-4 w-36" />
          ) : (
            <>
              <p className="font-semibold text-sm truncate">{data?.stationName ?? stationCode}</p>
              <p className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{stationCode}</p>
            </>
          )}
        </div>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
          {trains.length} trains
        </span>
      </div>

      <StaleBar stale={data?.stale ?? false} lastUpdated={data?.lastUpdated ?? null} queryKey={['station', stationCode]} />

      {/* Tabs */}
      <div className="flex px-4 pt-3 pb-1 gap-2">
        {(['dep', 'arr'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: tab === t ? 'var(--accent-red)' : 'var(--bg-card)',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${tab === t ? 'var(--accent-red)' : 'var(--border)'}`,
            }}
          >
            {t === 'dep' ? 'Departures' : 'Arrivals'}
          </button>
        ))}
      </div>

      {/* Note: arrivals not yet indexed — show departures for both tabs */}
      {tab === 'arr' && (
        <p className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Arrival tracking coming soon. Showing departure data.
        </p>
      )}

      {isLoading && (
        <div className="pt-2 space-y-0">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
          <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Station data unavailable</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Try again in a moment</p>
        </div>
      )}

      {empty && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
          <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M3 10h18M3 14h18M10 3L7 21M17 3l-3 18" />
          </svg>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No trains right now</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Live trains at this station will appear here</p>
        </div>
      )}

      {!isLoading && trains.length > 0 && (
        <div className="fade-in pt-1 pb-4">
          {trains.map((entry) => (
            <TrainRow key={entry.trainNumber} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
