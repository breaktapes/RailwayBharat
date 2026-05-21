'use client';
import { useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { DelayBadge } from '@/components/ui/DelayBadge';

interface TrainResult {
  trainNumber: string;
  trainName: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  runsOn?: string[];
  classes?: string[];
  distance?: number;
}

interface BetweenResponse {
  trains?: TrainResult[];
  error?: string;
}

export default function BetweenPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TrainResult[] | null>(null);
  const [error, setError] = useState('');

  const handleSwap = useCallback(() => {
    setFrom(to);
    setTo(from);
    setResults(null);
  }, [from, to]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const f = from.trim().toUpperCase();
      const t = to.trim().toUpperCase();
      if (!f || !t || f === t) return;

      setLoading(true);
      setError('');
      setResults(null);

      try {
        const res = await fetch(`/api/between?from=${f}&to=${t}`);
        const data: BetweenResponse = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? 'Upstream error');
        setResults(data.trains ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch trains');
      } finally {
        setLoading(false);
      }
    },
    [from, to]
  );

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full overflow-y-auto" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(13,13,26,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <p className="font-semibold text-sm">Trains Between Stations</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Find trains between any two stations</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mx-3 mt-3 p-4 rounded-2xl space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex gap-2 items-end">
          {/* Station inputs */}
          <div className="flex-1 space-y-2">
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>From</label>
              <input
                type="text"
                value={from}
                onChange={(e) => { setFrom(e.target.value.toUpperCase()); setResults(null); }}
                placeholder="NDLS"
                maxLength={7}
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm font-mono font-semibold outline-none uppercase"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--accent-red)',
                  letterSpacing: '0.05em',
                }}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>To</label>
              <input
                type="text"
                value={to}
                onChange={(e) => { setTo(e.target.value.toUpperCase()); setResults(null); }}
                placeholder="MAS"
                maxLength={7}
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm font-mono font-semibold outline-none uppercase"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--accent-red)',
                  letterSpacing: '0.05em',
                }}
                required
              />
            </div>
          </div>

          {/* Swap button */}
          <button
            type="button"
            onClick={handleSwap}
            className="mb-0.5 p-3 rounded-xl transition-all hover:bg-white/10 active:scale-95"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            aria-label="Swap stations"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        <button
          type="submit"
          disabled={loading || !from.trim() || !to.trim()}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'var(--accent-red)', color: '#fff' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity={0.3} />
                <path d="M21 12a9 9 0 00-9-9" />
              </svg>
              Searching…
            </span>
          ) : 'Search trains'}
        </button>
      </form>

      {error && (
        <div className="mx-3 mt-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--delayed-severe)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 px-8 text-center">
          <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No trains found</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Try different station codes</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="fade-in mt-3 pb-4">
          <div className="px-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {results.length} trains found · {from} → {to}
            </p>
          </div>

          <div className="space-y-2 mx-3">
            {results.map((train) => (
              <Link
                key={train.trainNumber}
                href={`/train/${train.trainNumber}`}
                className="block rounded-2xl overflow-hidden transition-all hover:border-white/20"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between px-4 pt-3 pb-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{train.trainName}</p>
                    <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{train.trainNumber}</p>
                  </div>
                  {train.duration && (
                    <span className="text-xs font-mono px-2 py-1 rounded-lg mt-0.5" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
                      {train.duration}
                    </span>
                  )}
                </div>

                {(train.departureTime || train.arrivalTime) && (
                  <div
                    className="flex items-center gap-3 px-4 py-2"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    {train.departureTime && (
                      <div>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>DEP</p>
                        <p className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{train.departureTime}</p>
                      </div>
                    )}
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    {train.arrivalTime && (
                      <div className="text-right">
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ARR</p>
                        <p className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{train.arrivalTime}</p>
                      </div>
                    )}
                  </div>
                )}

                {(train.runsOn || train.classes || train.distance) && (
                  <div
                    className="flex items-center gap-3 px-4 py-2 text-xs"
                    style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  >
                    {train.distance && <span>{train.distance} km</span>}
                    {train.classes && (
                      <span>{train.classes.slice(0, 4).join(' · ')}</span>
                    )}
                    {train.runsOn && (
                      <div className="ml-auto flex gap-0.5">
                        {DAY_LABELS.map((d, i) => (
                          <span
                            key={d}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium"
                            style={{
                              background: train.runsOn!.includes(d) ? 'rgba(233,69,96,0.2)' : 'var(--bg-base)',
                              color: train.runsOn!.includes(d) ? 'var(--accent-red)' : 'var(--text-muted)',
                            }}
                          >
                            {d[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
