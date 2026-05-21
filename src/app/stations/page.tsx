'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

interface StationResult {
  station_code: string;
  station_name: string;
  state?: string;
}

const POPULAR_STATIONS = [
  { code: 'NDLS', name: 'New Delhi', state: 'Delhi' },
  { code: 'CSTM', name: 'Mumbai CST', state: 'Maharashtra' },
  { code: 'HWH', name: 'Howrah Jn', state: 'West Bengal' },
  { code: 'MAS', name: 'Chennai Central', state: 'Tamil Nadu' },
  { code: 'SBC', name: 'Bengaluru City', state: 'Karnataka' },
  { code: 'HYB', name: 'Hyderabad Deccan', state: 'Telangana' },
  { code: 'PUNE', name: 'Pune Jn', state: 'Maharashtra' },
  { code: 'ADI', name: 'Ahmedabad', state: 'Gujarat' },
  { code: 'JP', name: 'Jaipur', state: 'Rajasthan' },
  { code: 'LKO', name: 'Lucknow', state: 'Uttar Pradesh' },
  { code: 'BPL', name: 'Bhopal', state: 'Madhya Pradesh' },
  { code: 'PNBE', name: 'Patna', state: 'Bihar' },
];

async function searchStations(q: string): Promise<StationResult[]> {
  if (!q || q.length < 2) return [];
  const res = await fetch(`/api/stations/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

function StationCard({ code, name, state }: { code: string; name: string; state?: string }) {
  return (
    <Link
      href={`/station/${code}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 active:bg-white/8"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold font-mono"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--accent-red)' }}
      >
        {code.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {code}{state ? ` · ${state}` : ''}
        </p>
      </div>
      <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="9,18 15,12 9,6" />
      </svg>
    </Link>
  );
}

export default function StationsPage() {
  const [query, setQuery] = useState('');

  const { data: results, isFetching } = useQuery({
    queryKey: ['station-search', query],
    queryFn: () => searchStations(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  const handleClear = useCallback(() => setQuery(''), []);
  const showResults = query.length >= 2;

  return (
    <div className="h-full overflow-y-auto" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-3 space-y-3"
        style={{ background: 'rgba(13,13,26,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <p className="font-semibold text-sm">Stations</p>

        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-secondary)' }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or code…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {showResults && (
        <div className="fade-in pb-4">
          {isFetching && (
            <div className="px-4 py-3">
              <div className="skeleton h-3 w-28" />
            </div>
          )}
          {!isFetching && results && results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              No stations found for &quot;{query}&quot;
            </p>
          )}
          {results && results.length > 0 && results.map((s) => (
            <StationCard key={s.station_code} code={s.station_code} name={s.station_name} state={s.state} />
          ))}
        </div>
      )}

      {/* Popular stations */}
      {!showResults && (
        <div className="pb-4">
          {/* Between stations shortcut */}
          <Link
            href="/between"
            className="mx-4 mt-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors hover:bg-white/5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.2)' }}
            >
              <svg className="w-5 h-5" style={{ color: 'var(--accent-red)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Trains Between Stations</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Find all trains connecting two stations</p>
            </div>
            <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </Link>

          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Popular Stations
            </p>
          </div>
          {POPULAR_STATIONS.map((s) => (
            <StationCard key={s.code} code={s.code} name={s.name} state={s.state} />
          ))}
        </div>
      )}
    </div>
  );
}
