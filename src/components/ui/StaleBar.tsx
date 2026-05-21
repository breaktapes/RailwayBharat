'use client';
import { useQueryClient } from '@tanstack/react-query';

interface StaleBarProps {
  lastUpdated: string | null;
  stale: boolean;
  queryKey: unknown[];
}

export function StaleBar({ lastUpdated, stale, queryKey }: StaleBarProps) {
  const qc = useQueryClient();
  if (!stale) return null;

  const minutesAgo = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000)
    : null;

  return (
    <div
      role="alert"
      className="flex items-center justify-between px-4 py-2 text-sm font-medium fade-in"
      style={{
        background: 'rgba(234,179,8,0.12)',
        borderBottom: '1px solid rgba(234,179,8,0.3)',
        color: '#eab308',
      }}
    >
      <span>
        {minutesAgo !== null
          ? `Trains last seen ${minutesAgo} min ago`
          : 'Live data loading…'}
      </span>
      <button
        onClick={() => qc.invalidateQueries({ queryKey })}
        className="text-xs px-2 py-0.5 rounded border border-yellow-500/40 hover:bg-yellow-500/10 transition-colors"
        aria-label="Refresh train data"
      >
        Refresh
      </button>
    </div>
  );
}
