'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { DbTrain } from '@/lib/supabase/client';

interface SearchResult {
  train_number: string;
  train_name: string;
  from_station: string;
  to_station: string;
}

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

export function SearchBar({ placeholder = 'Search trains… (e.g. 12301 or Rajdhani)', className = '' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { data: results = [] } = useQuery<SearchResult[]>({
    queryKey: ['train-search', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/trains/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
    refetchInterval: false,
  });

  useEffect(() => {
    setOpen(focused && query.length >= 2 && results.length > 0);
  }, [focused, query, results]);

  function handleSelect(trainNumber: string) {
    setQuery('');
    setOpen(false);
    router.push(`/train/${trainNumber}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setQuery(''); setOpen(false); }
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl"
        style={{
          background: 'rgba(19,19,42,0.95)',
          border: `1px solid ${focused ? 'var(--accent-red)' : 'var(--border)'}`,
          backdropFilter: 'blur(12px)',
          transition: 'border-color 0.15s',
        }}
      >
        <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-secondary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search trains by name or number"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Clear search" className="shrink-0" style={{ color: 'var(--text-secondary)' }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 fade-in"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
        >
          {results.slice(0, 5).map((r) => (
            <li key={r.train_number} role="option">
              <button
                onClick={() => handleSelect(r.train_number)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
              >
                <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>
                  {r.train_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.train_name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{r.from_station} → {r.to_station}</p>
                </div>
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
