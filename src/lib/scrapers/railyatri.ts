import axios from 'axios';
import type { LiveTrain, ScraperError, ScraperTransport } from '@/types';

const RAILYATRI_BASE = 'https://www.railyatri.in';
const RAILYATRI_STATUS_URL = `${RAILYATRI_BASE}/live-train-status/api`;

const REQUEST_TIMEOUT_MS = 8000;

interface RailYatriStop {
  stationCode: string;
  stationName: string;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
  actualArrival: string | null;
  actualDeparture: string | null;
  delayInMins: number;
  platform: string | null;
}

interface RailYatriResponse {
  success: boolean;
  data?: {
    trainNo: string;
    trainName: string;
    currentStation: {
      code: string;
      name: string;
    };
    nextStation?: {
      code: string;
      name: string;
    };
    delayMins: number;
    status: string;
    stationList: RailYatriStop[];
  };
  message?: string;
}

export class RailYatriScraper implements ScraperTransport {
  private stationCoords: Map<string, { lat: number; lng: number }>;

  constructor(stationCoords: Map<string, { lat: number; lng: number }>) {
    this.stationCoords = stationCoords;
  }

  async fetchTrainStatus(trainNumber: string): Promise<LiveTrain | ScraperError | null> {
    try {
      const response = await axios.get<RailYatriResponse>(RAILYATRI_STATUS_URL, {
        params: { trainNo: trainNumber },
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 10; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          Accept: 'application/json',
          Referer: RAILYATRI_BASE,
        },
      });

      const body = response.data;
      if (!body.success || !body.data) {
        if (body.message?.toLowerCase().includes('not running')) return null;
        return { type: 'parse_error', message: body.message };
      }

      const d = body.data;
      const coords = this.stationCoords.get(d.currentStation.code);

      return {
        trainNumber: d.trainNo,
        trainName: d.trainName,
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        currentStation: d.currentStation.name,
        currentStationCode: d.currentStation.code,
        nextStation: d.nextStation?.name ?? '',
        nextStationCode: d.nextStation?.code ?? '',
        lastReported: new Date().toISOString(),
        delayMinutes: d.delayMins,
        status: d.status.toLowerCase().includes('cancel') ? 'cancelled' : 'running',
      };
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
