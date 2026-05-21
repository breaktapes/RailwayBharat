'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface SearchResult {
  train_number: string;
  train_name: string;
  from_station?: string;
  to_station?: string;
}

async function searchTrains(q: string): Promise<SearchResult[]> {
  if (!q || q.length < 2) return [];
  const res = await fetch(`/api/trains/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

const RECENTS_KEY = 'rb:search:recents';
const MAX_RECENTS = 8;

function loadRecents(): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function addRecent(r: SearchResult) {
  const current = loadRecents();
  const next = [r, ...current.filter((x) => x.train_number !== r.train_number)].slice(0, MAX_RECENTS);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

function TrainRow({ result, onSelect }: { result: SearchResult; onSelect: (r: SearchResult) => void }) {
  return (
    <button
      onClick={() => onSelect(result)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/8"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <svg className="w-4 h-4" style={{ color: 'var(--accent-red)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{result.train_name}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-mono">{result.train_number}</span>
          {result.from_station && result.to_station && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span className="truncate">{result.from_station} → {result.to_station}</span>
            </>
          )}
        </div>
      </div>
      <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="9,18 15,12 9,6" />
      </svg>
    </button>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<SearchResult[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRecents(loadRecents());
    setMounted(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTrains(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  const handleSelect = useCallback((result: SearchResult) => {
    addRecent(result);
    router.push(`/train/${result.train_number}`);
  }, [router]);

  const clearRecents = useCallback(() => {
    localStorage.removeItem(RECENTS_KEY);
    setRecents([]);
  }, []);

  const showResults = query.length >= 2;
  const showRecents = !showResults && mounted && recents.length > 0;

  return (
    <div className="h-full flex flex-col" style={{ color: 'var(--text-primary)' }}>
      {/* Search bar header */}
      <div
        className="px-4 py-3 space-y-0"
        style={{ background: 'rgba(13,13,26,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <p className="font-semibold text-sm mb-2">Search Trains</p>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: isFetching ? 'var(--accent-red)' : 'var(--text-secondary)' }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Train name or number…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Search results */}
        {showResults && (
          <div className="fade-in pb-4">
            {isFetching && (
              <div className="px-4 py-3 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-9 h-9 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-40" />
                      <div className="skeleton h-2.5 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isFetching && results && results.length === 0 && (
              <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                No trains found for &quot;{query}&quot;
              </p>
            )}

            {results && results.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Results
                  </p>
                </div>
                {results.map((r) => (
                  <TrainRow key={r.train_number} result={r} onSelect={handleSelect} />
                ))}
              </>
            )}
          </div>
        )}

        {/* Recent searches */}
        {showRecents && (
          <div className="pb-4 fade-in">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Recent
              </p>
              <button
                onClick={clearRecents}
                className="text-xs"
                style={{ color: 'var(--accent-red)' }}
              >
                Clear
              </button>
            </div>
            {recents.map((r) => (
              <TrainRow key={r.train_number} result={r} onSelect={handleSelect} />
            ))}
          </div>
        )}

        {/* Empty prompt */}
        {!showResults && !showRecents && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
            <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Search by train name or 5-digit number
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
