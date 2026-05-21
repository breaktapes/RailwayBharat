import axios from 'axios';
import * as cheerio from 'cheerio';
import type { LiveTrain, ScraperError, ScraperTransport } from '@/types';
import { isScraperError } from '@/types';

const NTES_BASE = 'https://enquiry.indianrail.gov.in';
const NTES_HOME = `${NTES_BASE}/mntes/`;
const NTES_STATUS_URL = `${NTES_BASE}/mntes/mntes_servlet?action=getTrainRunningStatus`;

const REQUEST_TIMEOUT_MS = 8000;

function makeHeaders(cookie: string): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 10; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: NTES_HOME,
    Cookie: cookie,
  };
}

/** Bootstraps a session with NTES and returns the cookie string. */
async function bootstrapSession(): Promise<string> {
  const response = await axios.get(NTES_HOME, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 10; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    },
    withCredentials: true,
    maxRedirects: 5,
  });

  const setCookieHeader = response.headers['set-cookie'];
  if (!setCookieHeader) throw new Error('NTES: no cookie returned from homepage');

  return Array.isArray(setCookieHeader)
    ? setCookieHeader.map((c) => c.split(';')[0]).join('; ')
    : setCookieHeader.split(';')[0];
}

interface NtesRawStop {
  stnCode: string;
  stnName: string;
  schArr: string;
  schDep: string;
  actArr: string;
  actDep: string;
  delayArr: string;
  delayDep: string;
  platform: string;
}

interface NtesStatusResponse {
  trainNumber?: string;
  trainName?: string;
  currentStnCode?: string;
  currentStnName?: string;
  runDate?: string;
  stopsList?: NtesRawStop[];
  errorMessage?: string;
}

function parseDelayMinutes(delayStr: string): number {
  if (!delayStr || delayStr === '00:00' || delayStr === 'ON TIME') return 0;
  const match = delayStr.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function buildLiveTrain(
  trainNumber: string,
  data: NtesStatusResponse,
  stationCoords: Map<string, { lat: number; lng: number }>
): LiveTrain | null {
  if (!data.trainNumber || !data.stopsList?.length) return null;

  const stops = data.stopsList;
  const currentIdx = stops.findIndex((s) => s.stnCode === data.currentStnCode);
  const currentStop = currentIdx >= 0 ? stops[currentIdx] : stops[stops.length - 1];
  const nextStop = currentIdx >= 0 && currentIdx < stops.length - 1
    ? stops[currentIdx + 1]
    : null;

  const coords = stationCoords.get(currentStop.stnCode);
  const delayMinutes = parseDelayMinutes(currentStop.delayDep || currentStop.delayArr);

  return {
    trainNumber: data.trainNumber,
    trainName: data.trainName ?? trainNumber,
    lat: coords?.lat ?? 0,
    lng: coords?.lng ?? 0,
    currentStation: currentStop.stnName,
    currentStationCode: currentStop.stnCode,
    nextStation: nextStop?.stnName ?? stops[stops.length - 1].stnName,
    nextStationCode: nextStop?.stnCode ?? stops[stops.length - 1].stnCode,
    lastReported: new Date().toISOString(),
    delayMinutes,
    status: delayMinutes === 0 ? 'running' : 'running',
  };
}

export class NTESScraper implements ScraperTransport {
  private stationCoords: Map<string, { lat: number; lng: number }>;

  constructor(stationCoords: Map<string, { lat: number; lng: number }>) {
    this.stationCoords = stationCoords;
  }

  async fetchTrainStatus(trainNumber: string): Promise<LiveTrain | ScraperError | null> {
    let cookie: string;

    try {
      cookie = await bootstrapSession();
    } catch (err) {
      return { type: 'network_error', message: String(err) };
    }

    try {
      const response = await axios.post<NtesStatusResponse>(
        NTES_STATUS_URL,
        new URLSearchParams({
          trainNo: trainNumber,
          action: 'getTrainRunningStatus',
        }).toString(),
        {
          headers: makeHeaders(cookie),
          timeout: REQUEST_TIMEOUT_MS,
        }
      );

      const data = response.data;

      if (data.errorMessage?.includes('not running')) {
        return null; // not_found — train not running today
      }

      if (data.errorMessage) {
        return { type: 'parse_error', message: data.errorMessage };
      }

      const train = buildLiveTrain(trainNumber, data, this.stationCoords);
      if (!train) return { type: 'parse_error', message: 'Could not parse train data' };
      return train;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) {
          const retryAfter = parseInt(err.response.headers['retry-after'] ?? '60');
          return { type: 'rate_limit', retryAfter };
        }
        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
          return { type: 'network_error', message: 'timeout' };
        }
      }
      return { type: 'network_error', message: String(err) };
    }
  }
}
