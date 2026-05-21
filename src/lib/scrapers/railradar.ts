import axios from 'axios';
import type { LiveTrain, LiveTrainDetail, ScraperError, StationStop } from '@/types';

const RAILRADAR_BASE = 'https://api.railradar.in/api/v1';
// Key is hardcoded in railradar.in client JS — treat as best-effort, fallback on failure
const RAILRADAR_KEY = 'rr_prod_3cf4ebe1abdf49338c02f37a11f135d6';

const REQUEST_TIMEOUT_MS = 5000;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 10; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://railradar.in/',
};

interface RailRadarLiveMapEntry {
  train_number: string;
  train_name: string;
  type?: string;
  current_lat: number;
  current_lng: number;
  current_station: string;
  current_station_name: string;
  next_station: string;
  next_station_name: string;
  next_arrival_minutes?: number;
  mins_since_dep?: number;
  curr_distance?: number;
}

interface RailRadarStop {
  stationCode: string;
  stationName: string;
  scheduledArrival?: string | null;
  scheduledDeparture?: string | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  delayArrivalMinutes?: number;
  delayDepartureMinutes?: number;
  platform?: string | null;
}

interface RailRadarTrainDetail {
  trainNumber: string;
  trainName: string;
  latitude: number;
  longitude: number;
  status?: string;
  delayMinutes?: number;
  fromStation?: string;
  toStation?: string;
  route?: RailRadarStop[];
  dataSource?: string;
}

/** Fetches all live trains in India with lat/lng in a single call. */
export async function fetchAllLiveTrains(): Promise<LiveTrain[] | ScraperError> {
  try {
    const response = await axios.get<RailRadarLiveMapEntry[]>(
      `${RAILRADAR_BASE}/trains/live-map`,
      {
        params: { apiKey: RAILRADAR_KEY },
        timeout: REQUEST_TIMEOUT_MS,
        headers: HEADERS,
      }
    );

    const raw = response.data;
    // API returns either a raw array or {success: true, data: [...]}
    const entries: RailRadarLiveMapEntry[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { data?: unknown }).data)
      ? (raw as { data: RailRadarLiveMapEntry[] }).data
      : null!;

    if (!Array.isArray(entries)) {
      return { type: 'parse_error', message: 'live-map response is not an array' };
    }

    return entries
      .filter((e) => e.current_lat && e.current_lng)
      .map((e): LiveTrain => ({
        trainNumber: e.train_number,
        trainName: e.train_name,
        lat: e.current_lat,
        lng: e.current_lng,
        currentStation: e.current_station_name ?? e.current_station,
        currentStationCode: e.current_station,
        nextStation: e.next_station_name ?? e.next_station,
        nextStationCode: e.next_station,
        lastReported: new Date().toISOString(),
        delayMinutes: 0, // live-map doesn't include delay; enriched on detail fetch
        status: 'running',
      }));
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 429) {
        return { type: 'rate_limit', retryAfter: 60 };
      }
      if (err.response?.status === 403 || err.response?.status === 401) {
        // API key may have been rotated
        return { type: 'network_error', message: `RailRadar key rejected (${err.response.status})` };
      }
    }
    return { type: 'network_error', message: String(err) };
  }
}

/** Fetches full detail for a single train (route, delays, platforms). */
export async function fetchTrainDetail(
  trainNumber: string,
  journeyDate?: string
): Promise<LiveTrainDetail | ScraperError | null> {
  const date = journeyDate ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const response = await axios.get<RailRadarTrainDetail>(
      `${RAILRADAR_BASE}/trains/${trainNumber}`,
      {
        params: { journeyDate: date, dataType: 'live', apiKey: RAILRADAR_KEY },
        timeout: REQUEST_TIMEOUT_MS,
        headers: HEADERS,
      }
    );

    const d = response.data;
    if (!d.trainNumber) return null;

    const stops: StationStop[] = (d.route ?? []).map((s, i, arr) => {
      const isPassed = (s.actualDeparture !== null && s.actualDeparture !== undefined);
      const isCurrent = !isPassed && i > 0 && (arr[i - 1].actualDeparture !== null);
      return {
        stationCode: s.stationCode,
        stationName: s.stationName,
        scheduledArr: s.scheduledArrival ?? null,
        scheduledDep: s.scheduledDeparture ?? null,
        actualArr: s.actualArrival ?? null,
        actualDep: s.actualDeparture ?? null,
        delayMinutes: s.delayDepartureMinutes ?? s.delayArrivalMinutes ?? 0,
        platform: s.platform ? `PF ${s.platform}` : null,
        status: isPassed ? 'departed' : isCurrent ? 'current' : 'upcoming',
      };
    });

    const currentIdx = stops.findIndex((s) => s.status === 'current');
    const completedCount = stops.filter((s) => s.status === 'departed').length;

    return {
      trainNumber: d.trainNumber,
      trainName: d.trainName,
      lat: d.latitude,
      lng: d.longitude,
      currentStation: stops[currentIdx]?.stationName ?? stops[0].stationName,
      currentStationCode: stops[currentIdx]?.stationCode ?? stops[0].stationCode,
      nextStation: stops[currentIdx + 1]?.stationName ?? stops[stops.length - 1].stationName,
      nextStationCode: stops[currentIdx + 1]?.stationCode ?? stops[stops.length - 1].stationCode,
      lastReported: new Date().toISOString(),
      delayMinutes: d.delayMinutes ?? stops[currentIdx]?.delayMinutes ?? 0,
      status: 'running',
      fromStation: d.fromStation ?? stops[0].stationCode,
      toStation: d.toStation ?? stops[stops.length - 1].stationCode,
      stops,
      stopsCompleted: completedCount,
      stopsTotal: stops.length,
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) return null;
      if (err.response?.status === 429) return { type: 'rate_limit', retryAfter: 60 };
      if (err.response?.status === 403) return { type: 'network_error', message: 'key rejected' };
    }
    return { type: 'network_error', message: String(err) };
  }
}
