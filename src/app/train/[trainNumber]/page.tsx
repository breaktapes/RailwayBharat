'use client';
import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DelayBadge } from '@/components/ui/DelayBadge';
import { SkeletonCard, SkeletonRow } from '@/components/ui/SkeletonCard';
import { StaleBar } from '@/components/ui/StaleBar';
import type { LiveTrainDetail, StationStop } from '@/types';

interface TrainDetailResponse extends LiveTrainDetail {
  stale?: boolean;
  lastUpdated?: string;
}

async function fetchTrainDetail(id: string): Promise<TrainDetailResponse> {
  const res = await fetch(`/api/train/${id}`);
  if (!res.ok) throw new Error('Train data unavailable');
  return res.json();
}

function RouteProgress({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>{completed} stations passed</span>
        <span>{total - completed} remaining</span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: 'var(--accent-red)' }}
        />
        {/* Train icon on the progress bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 text-[8px]"
          style={{ left: `calc(${pct}% - 6px)`, transition: 'left 1s' }}
        >
          🚂
        </div>
      </div>
    </div>
  );
}

function StopRow({ stop, isFirst, isLast }: { stop: StationStop; isFirst: boolean; isLast: boolean }) {
  const isPassed = stop.status === 'departed';
  const isCurrent = stop.status === 'current';

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors ${isCurrent ? 'rounded-xl mx-2' : ''}`}
      style={{
        background: isCurrent ? 'rgba(233,69,96,0.08)' : 'transparent',
        opacity: isPassed ? 0.45 : 1,
      }}
    >
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0 mt-0.5" style={{ width: 16 }}>
        <div
          className={`w-2.5 h-2.5 rounded-full border-2 ${isCurrent ? 'live-pulse' : ''}`}
          style={{
            borderColor: isCurrent ? 'var(--accent-red)' : isPassed ? 'var(--text-muted)' : 'var(--border)',
            background: isCurrent ? 'var(--accent-red)' : isPassed ? 'var(--text-muted)' : 'transparent',
          }}
        />
        {!isLast && (
          <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)', minHeight: 20 }} />
        )}
      </div>

      {/* Station info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm ${isCurrent ? 'font-semibold' : 'font-medium'}`}
            style={{ color: isCurrent ? 'var(--text-primary)' : isPassed ? 'var(--text-secondary)' : 'var(--text-primary)' }}
          >
            {stop.stationName}
          </span>
          <span className="font-mono text-[10px] px-1 rounded" style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>
            {stop.stationCode}
          </span>
          {stop.platform && (
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              {stop.platform}
            </span>
          )}
          {isCurrent && <span className="text-[10px] font-semibold" style={{ color: 'var(--accent-red)' }}>● LIVE</span>}
        </div>
        <div className="flex gap-4 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {stop.scheduledArr && (
            <span>
              ARR{' '}
              <span className="font-mono" style={{ color: stop.actualArr && stop.delayMinutes > 0 ? 'var(--delayed-mild)' : 'inherit' }}>
                {stop.actualArr ?? stop.scheduledArr}
              </span>
              {stop.scheduledArr !== stop.actualArr && stop.actualArr && (
                <span className="ml-1" style={{ color: 'var(--text-muted)' }}>sch {stop.scheduledArr}</span>
              )}
            </span>
          )}
          {stop.scheduledDep && (
            <span>
              DEP{' '}
              <span className="font-mono" style={{ color: stop.actualDep && stop.delayMinutes > 0 ? 'var(--delayed-mild)' : 'inherit' }}>
                {stop.actualDep ?? stop.scheduledDep}
              </span>
            </span>
          )}
          {stop.delayMinutes > 0 && (
            <DelayBadge minutes={stop.delayMinutes} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function TrainDetailPage({ params }: { params: Promise<{ trainNumber: string }> }) {
  const { trainNumber } = use(params);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['train-detail', trainNumber],
    queryFn: () => fetchTrainDetail(trainNumber),
  });

  return (
    <div className="h-full overflow-y-auto" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(13,13,26,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <Link href="/" aria-label="Back to map" className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="skeleton h-4 w-40" />
          ) : (
            <>
              <p className="font-semibold text-sm truncate">{data?.trainName ?? trainNumber}</p>
              <p className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{trainNumber}</p>
            </>
          )}
        </div>
        {data && <DelayBadge minutes={data.delayMinutes} size="sm" />}
      </div>

      <StaleBar stale={data?.stale ?? false} lastUpdated={data?.lastUpdated ?? null} queryKey={['train-detail', trainNumber]} />

      {isLoading && (
        <div className="space-y-1">
          <SkeletonCard rows={4} />
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
          <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Live data unavailable right now</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Try again in a moment</p>
        </div>
      )}

      {data && !isLoading && (
        <div className="fade-in">
          {/* Current status card */}
          <div className="mx-3 mt-3 p-4 rounded-2xl space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>
                {data.fromStation} <span style={{ color: 'var(--text-muted)' }}>→</span> {data.toStation}
              </span>
              <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                {data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST' : ''}
              </span>
            </div>

            {/* Current + Next station */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full live-pulse shrink-0" style={{ background: 'var(--on-time)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Currently at</p>
                  <p className="font-semibold">{data.currentStation}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--border)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Next stop</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.nextStation}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <RouteProgress completed={data.stopsCompleted} total={data.stopsTotal} />

          {/* Divider */}
          <div className="px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Route — {data.stopsTotal} stations
            </p>
          </div>

          {/* Station timeline */}
          <div className="pb-4">
            {data.stops.map((stop, i) => (
              <StopRow
                key={stop.stationCode}
                stop={stop}
                isFirst={i === 0}
                isLast={i === data.stops.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
