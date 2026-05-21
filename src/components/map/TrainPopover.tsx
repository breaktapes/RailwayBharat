'use client';
import Link from 'next/link';
import { DelayBadge } from '@/components/ui/DelayBadge';
import type { LiveTrain } from '@/types';

interface TrainPopoverProps {
  train: LiveTrain;
  onClose: () => void;
}

export function TrainPopover({ train, onClose }: TrainPopoverProps) {
  return (
    <>
      {/* Backdrop — tap to close on mobile */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Bottom sheet on mobile / floating card on desktop */}
      <div
        className="fixed z-50 bottom-sheet"
        style={{
          bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          left: 0,
          right: 0,
          padding: '0 12px 12px',
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
          </div>

          <div className="px-4 pb-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                  {train.trainName}
                </p>
                <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {train.trainNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DelayBadge minutes={train.delayMinutes} size="sm" />
                <button
                  onClick={onClose}
                  aria-label="Close train details"
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Station info */}
            <div
              className="rounded-xl p-3 space-y-2"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full live-pulse" style={{ background: 'var(--on-time)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>At</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{train.currentStation}</span>
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{train.currentStationCode}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full ml-0" style={{ background: 'var(--border)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>Next</span>
                <span style={{ color: 'var(--text-primary)' }}>{train.nextStation}</span>
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{train.nextStationCode}</span>
              </div>
            </div>

            {/* CTA */}
            <Link
              href={`/train/${train.trainNumber}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: 'var(--accent-red)', color: '#fff' }}
            >
              Track this train
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
