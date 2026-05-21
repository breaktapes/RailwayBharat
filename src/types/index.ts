export interface LiveTrain {
  trainNumber: string;
  trainName: string;
  lat: number;
  lng: number;
  currentStation: string;
  currentStationCode: string;
  nextStation: string;
  nextStationCode: string;
  lastReported: string; // ISO 8601
  delayMinutes: number;
  status: 'running' | 'arrived' | 'cancelled' | 'unknown';
}

export interface LiveTrainsResponse {
  trains: LiveTrain[];
  lastUpdated: string | null; // ISO 8601
  stale: boolean;
  count: number;
}

export interface StationStop {
  stationCode: string;
  stationName: string;
  scheduledArr: string | null; // HH:MM
  scheduledDep: string | null; // HH:MM
  actualArr: string | null;
  actualDep: string | null;
  delayMinutes: number;
  platform: string | null; // "PF 3" format
  status: 'departed' | 'current' | 'upcoming' | 'unknown';
}

export interface LiveTrainDetail extends LiveTrain {
  fromStation: string;
  toStation: string;
  stops: StationStop[];
  stopsCompleted: number;
  stopsTotal: number;
}

export interface StationBoard {
  stationCode: string;
  stationName: string;
  trains: StationBoardEntry[];
  lastUpdated: string | null;
}

export interface StationBoardEntry {
  trainNumber: string;
  trainName: string;
  scheduledDep: string; // HH:MM
  actualDep: string | null;
  delayMinutes: number;
  platform: string | null;
  status: 'running' | 'arrived' | 'cancelled' | 'unknown';
  destination: string;
}

export type ScraperErrorType =
  | 'rate_limit'
  | 'parse_error'
  | 'not_found'
  | 'network_error';

export interface ScraperError {
  type: ScraperErrorType;
  retryAfter?: number; // seconds, for rate_limit
  message?: string;
}

export interface ScraperTransport {
  fetchTrainStatus(trainNumber: string): Promise<LiveTrain | ScraperError | null>;
}

export function isScraperError(
  result: LiveTrain | ScraperError | null
): result is ScraperError {
  return result !== null && 'type' in result;
}
