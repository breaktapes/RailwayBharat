import { describe, it, expect, vi } from 'vitest';
import { fetchWithFallback } from './index';
import type { ScraperTransport, LiveTrain, ScraperError } from '@/types';

const mockTrain: LiveTrain = {
  trainNumber: '12301',
  trainName: 'Howrah Rajdhani',
  lat: 22.57,
  lng: 88.36,
  currentStation: 'Howrah Junction',
  currentStationCode: 'HWH',
  nextStation: 'Dhanbad Junction',
  nextStationCode: 'DHN',
  lastReported: new Date().toISOString(),
  delayMinutes: 0,
  status: 'running',
};

function makeScraper(result: LiveTrain | ScraperError | null): ScraperTransport {
  return { fetchTrainStatus: vi.fn().mockResolvedValue(result) };
}

describe('fetchWithFallback', () => {
  it('returns primary result on success', async () => {
    const primary = makeScraper(mockTrain);
    const fallback = makeScraper(null);
    const result = await fetchWithFallback('12301', primary, fallback);
    expect(result).toEqual(mockTrain);
    expect(fallback.fetchTrainStatus).not.toHaveBeenCalled();
  });

  it('returns null when primary says not_found, no fallback call', async () => {
    const primary = makeScraper(null);
    const fallback = makeScraper(mockTrain);
    const result = await fetchWithFallback('12301', primary, fallback);
    expect(result).toBeNull();
    expect(fallback.fetchTrainStatus).not.toHaveBeenCalled();
  });

  it('falls back on rate_limit', async () => {
    const rateLimitErr: ScraperError = { type: 'rate_limit', retryAfter: 60 };
    const primary = makeScraper(rateLimitErr);
    const fallback = makeScraper(mockTrain);
    const result = await fetchWithFallback('12301', primary, fallback);
    expect(result).toEqual(mockTrain);
    expect(fallback.fetchTrainStatus).toHaveBeenCalledWith('12301');
  });

  it('falls back on network_error', async () => {
    const netErr: ScraperError = { type: 'network_error', message: 'timeout' };
    const primary = makeScraper(netErr);
    const fallback = makeScraper(mockTrain);
    const result = await fetchWithFallback('12301', primary, fallback);
    expect(result).toEqual(mockTrain);
  });

  it('does NOT fall back on parse_error', async () => {
    const parseErr: ScraperError = { type: 'parse_error', message: 'bad HTML' };
    const primary = makeScraper(parseErr);
    const fallback = makeScraper(mockTrain);
    const result = await fetchWithFallback('12301', primary, fallback);
    expect(result).toEqual(parseErr);
    expect(fallback.fetchTrainStatus).not.toHaveBeenCalled();
  });

  it('returns fallback ScraperError when both fail', async () => {
    const rateLimitErr: ScraperError = { type: 'rate_limit', retryAfter: 60 };
    const netErr: ScraperError = { type: 'network_error', message: 'timeout' };
    const primary = makeScraper(rateLimitErr);
    const fallback = makeScraper(netErr);
    const result = await fetchWithFallback('12301', primary, fallback);
    expect(result).toEqual(netErr);
  });
});
