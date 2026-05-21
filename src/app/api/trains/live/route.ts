import { NextResponse } from 'next/server';
import { getAllLiveTrains } from '@/lib/redis/client';
import type { LiveTrainsResponse } from '@/types';

export const revalidate = 0;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const records = await getAllLiveTrains();

    if (records.length === 0) {
      const body: LiveTrainsResponse = {
        trains: [],
        lastUpdated: null,
        stale: true,
        count: 0,
      };
      return NextResponse.json(body, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    const latestUpdatedAt = Math.max(...records.map((r) => r.updatedAt));
    const ageMs = Date.now() - latestUpdatedAt;
    const stale = ageMs > 5 * 60 * 1000; // >5 min = stale

    const body: LiveTrainsResponse = {
      trains: records.map((r) => r.train),
      lastUpdated: new Date(latestUpdatedAt).toISOString(),
      stale,
      count: records.length,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error('[/api/trains/live]', err);
    const body: LiveTrainsResponse = {
      trains: [],
      lastUpdated: null,
      stale: true,
      count: 0,
    };
    return NextResponse.json(body, { status: 200, headers: CORS_HEADERS });
  }
}
