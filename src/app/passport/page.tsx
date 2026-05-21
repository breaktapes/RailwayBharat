'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Journey {
  id: string;
  trainNumber: string;
  trainName: string;
  journeyDate: string; // YYYY-MM-DD
  fromStation: string;
  toStation: string;
  coach?: string;
  pnr?: string;
  delayMinutes?: number;
  addedAt: number; // timestamp
}

const STORAGE_KEY = 'rb:passport:journeys';

function loadJourneys(): Journey[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveJourneys(journeys: Journey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function Stats({ journeys }: { journeys: Journey[] }) {
  const uniqueTrains = new Set(journeys.map((j) => j.trainNumber)).size;
  const uniqueStations = new Set(
    journeys.flatMap((j) => [j.fromStation, j.toStation])
  ).size;
  const delayed = journeys.filter((j) => (j.delayMinutes ?? 0) > 15).length;

  return (
    <div className="mx-3 mt-3 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Lifetime Stats</p>
      </div>
      <div className="grid grid-cols-3 divide-x" style={{ borderTop: '1px solid var(--border)', borderColor: 'var(--border)' }}>
        {[
          { label: 'Journeys', value: journeys.length },
          { label: 'Trains', value: uniqueTrains },
          { label: 'Stations', value: uniqueStations },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          </div>
        ))}
      </div>
      {journeys.length > 0 && (
        <div
          className="px-4 py-2.5 flex items-center justify-between text-xs"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <span>On-time arrivals</span>
          <span className="font-semibold" style={{ color: 'var(--on-time)' }}>
            {journeys.length > 0
              ? `${Math.round(((journeys.length - delayed) / journeys.length) * 100)}%`
              : '—'}
          </span>
        </div>
      )}
    </div>
  );
}

function JourneyCard({ journey, onDelete }: { journey: Journey; onDelete: (id: string) => void }) {
  const delayBg =
    !journey.delayMinutes || journey.delayMinutes <= 0
      ? 'var(--on-time)'
      : journey.delayMinutes < 30
      ? 'var(--delayed-mild)'
      : 'var(--delayed-severe)';

  return (
    <div
      className="mx-3 rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{journey.trainName}</p>
          <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{journey.trainNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          {journey.delayMinutes !== undefined && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${delayBg}22`, color: delayBg }}
            >
              {journey.delayMinutes <= 0 ? 'ON TIME' : `+${journey.delayMinutes}m`}
            </span>
          )}
          <button
            onClick={() => onDelete(journey.id)}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Delete journey"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="3,6 5,6 21,6" />
              <path d="M19,6l-1,14H6L5,6M10,11v6M14,11v6M9,6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Route */}
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="text-center shrink-0" style={{ minWidth: 48 }}>
          <p className="font-mono text-xs font-bold" style={{ color: 'var(--accent-red)' }}>{journey.fromStation}</p>
        </div>
        <div className="flex-1 flex items-center gap-1">
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          <svg className="w-3 h-3" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="9,18 15,12 9,6" />
          </svg>
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>
        <div className="text-center shrink-0" style={{ minWidth: 48 }}>
          <p className="font-mono text-xs font-bold" style={{ color: 'var(--accent-red)' }}>{journey.toStation}</p>
        </div>
      </div>

      {/* Footer meta */}
      <div
        className="flex items-center justify-between px-4 py-2 text-xs"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        <span>{formatDate(journey.journeyDate)}</span>
        <div className="flex items-center gap-3">
          {journey.coach && <span>Coach {journey.coach}</span>}
          {journey.pnr && <span className="font-mono">{journey.pnr}</span>}
        </div>
      </div>
    </div>
  );
}

interface ParsedBooking {
  pnr?: string;
  trainNumber?: string;
  trainName?: string;
  journeyDate?: string;
  fromStation?: string;
  toStation?: string;
  coach?: string;
  confidence: 'high' | 'medium' | 'low';
}

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (j: Journey) => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/passport/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const data: ParsedBooking = await res.json();
      setParsed(data);
    } catch {
      setError('Could not parse. Paste the full IRCTC SMS or email.');
    } finally {
      setLoading(false);
    }
  }, [text]);

  const handleAdd = useCallback(() => {
    if (!parsed?.trainNumber || !parsed?.journeyDate) return;
    const journey: Journey = {
      id: crypto.randomUUID(),
      trainNumber: parsed.trainNumber,
      trainName: parsed.trainName ?? parsed.trainNumber,
      journeyDate: parsed.journeyDate,
      fromStation: parsed.fromStation ?? '',
      toStation: parsed.toStation ?? '',
      coach: parsed.coach,
      pnr: parsed.pnr,
      addedAt: Date.now(),
    };
    onImport(journey);
    onClose();
  }, [parsed, onImport, onClose]);

  const canAdd = parsed && parsed.trainNumber && parsed.journeyDate && parsed.confidence !== 'low';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div
        className="fixed z-50 bottom-sheet"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, padding: '0 12px 12px' }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
          </div>

          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Import from IRCTC</p>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: 'var(--text-secondary)' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Paste your IRCTC booking confirmation SMS or email below.
            </p>

            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setParsed(null); setError(''); }}
              placeholder="Your booking has been confirmed. PNR: 1234567890…"
              rows={5}
              className="w-full rounded-xl px-3 py-2.5 text-xs resize-none outline-none"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                lineHeight: 1.6,
              }}
            />

            {error && (
              <p className="text-xs" style={{ color: 'var(--delayed-severe)' }}>{error}</p>
            )}

            {parsed && (
              <div
                className="rounded-xl p-3 space-y-1 text-xs"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <p className="font-semibold" style={{ color: 'var(--on-time)' }}>Parsed successfully</p>
                {parsed.trainName && <p style={{ color: 'var(--text-primary)' }}>{parsed.trainName} ({parsed.trainNumber})</p>}
                {parsed.journeyDate && <p style={{ color: 'var(--text-secondary)' }}>{formatDate(parsed.journeyDate)}</p>}
                {parsed.fromStation && parsed.toStation && (
                  <p style={{ color: 'var(--text-secondary)' }}>{parsed.fromStation} → {parsed.toStation}</p>
                )}
                {parsed.pnr && <p className="font-mono" style={{ color: 'var(--text-secondary)' }}>PNR {parsed.pnr}</p>}
              </div>
            )}

            <div className="flex gap-2">
              {!parsed ? (
                <button
                  onClick={handleParse}
                  disabled={loading || !text.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: 'var(--accent-red)', color: '#fff' }}
                >
                  {loading ? 'Parsing…' : 'Parse booking'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setParsed(null); setText(''); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!canAdd}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'var(--accent-red)', color: '#fff' }}
                  >
                    Add journey
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PassportPage() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    setJourneys(loadJourneys());
    setMounted(true);
  }, []);

  const handleImport = useCallback((journey: Journey) => {
    setJourneys((prev) => {
      const next = [journey, ...prev];
      saveJourneys(next);
      return next;
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setJourneys((prev) => {
      const next = prev.filter((j) => j.id !== id);
      saveJourneys(next);
      return next;
    });
  }, []);

  const sorted = [...journeys].sort((a, b) =>
    new Date(b.journeyDate).getTime() - new Date(a.journeyDate).getTime()
  );

  return (
    <div className="h-full overflow-y-auto" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(13,13,26,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <p className="font-semibold text-sm">Journey Passport</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your travel history</p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
          style={{ background: 'var(--accent-red)', color: '#fff' }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Import
        </button>
      </div>

      {mounted && journeys.length > 0 && <Stats journeys={journeys} />}

      {mounted && journeys.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-8 text-center">
          {/* Passport stamp icon */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <svg className="w-10 h-10" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M7 9h10M7 12h10M7 15h6" />
            </svg>
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>No journeys yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Import your IRCTC bookings to build your travel passport
            </p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'var(--accent-red)', color: '#fff' }}
          >
            Import first journey
          </button>
        </div>
      )}

      {!mounted && (
        <div className="mx-3 mt-3 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-24 skeleton" />
          ))}
        </div>
      )}

      {mounted && sorted.length > 0 && (
        <div className="mt-3 space-y-2 pb-4 fade-in">
          <div className="px-4 pb-1">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {journeys.length} {journeys.length === 1 ? 'Journey' : 'Journeys'}
            </p>
          </div>
          {sorted.map((j) => (
            <JourneyCard key={j.id} journey={j} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
