import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase env vars not configured');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Convenience alias for use in route handlers
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export interface DbTrain {
  id: number;
  train_number: string;
  train_name: string;
  from_station: string;
  to_station: string;
  runs_on: number; // 7-bit bitmask: bit 6=Mon, bit 5=Tue, ..., bit 0=Sun
}

export interface DbStation {
  id: number;
  station_code: string;
  station_name: string;
  lat: number | null;
  lng: number | null;
  zone: string | null;
}

export interface DbTrainSchedule {
  id: number;
  train_id: number;
  station_id: number;
  seq: number;
  arr_time: string | null; // HH:MM
  dep_time: string | null; // HH:MM
  distance_km: number | null;
}

/** Returns bitmask bit index for a given Date (0=Sunday, 1=Monday, ..., 6=Saturday). */
export function getDayBit(date: Date): number {
  return date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
}

/** Checks if a train with runs_on bitmask runs on the given date. */
export function trainRunsToday(runsOn: number, date: Date = new Date()): boolean {
  const bit = getDayBit(date);
  return (runsOn & (1 << bit)) !== 0;
}
