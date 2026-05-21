import { NextRequest, NextResponse } from 'next/server';
import { getStationDepartures, getTrainLive } from '@/lib/redis/client';
import { supabase } from '@/lib/supabase/client';
import type { StationBoard, StationBoardEntry } from '@/types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const stationCode = code.toUpperCase();

  try {
    // Look up station name
    const { data: station } = await supabase
      .from('stations')
      .select('station_name')
      .eq('station_code', stationCode)
      .single();

    const trainNumbers = await getStationDepartures(stationCode);

    const entries: StationBoardEntry[] = [];
    for (const trainNumber of trainNumbers) {
      const record = await getTrainLive(trainNumber);
      if (!record) continue;
      const t = record.train;
      entries.push({
        trainNumber: t.trainNumber,
        trainName: t.trainName,
        scheduledDep: '--:--', // placeholder — will be enriched with Supabase schedule data
        actualDep: null,
        delayMinutes: t.delayMinutes,
        platform: null,
        status: t.status,
        destination: t.nextStation,
      });
    }

    const board: StationBoard = {
      stationCode,
      stationName: station?.station_name ?? stationCode,
      trains: entries,
      lastUpdated: entries.length > 0 ? new Date().toISOString() : null,
    };

    return NextResponse.json(board, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error(`[/api/station/${stationCode}]`, err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
