import { NextRequest, NextResponse } from 'next/server';
import { getTrainLive } from '@/lib/redis/client';

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trainNumber = id.toUpperCase();

  try {
    const record = await getTrainLive(trainNumber);

    if (!record) {
      return NextResponse.json(
        { error: 'Train data unavailable', retryAfter: 30 },
        { status: 503, headers: CORS_HEADERS }
      );
    }

    const ageMs = Date.now() - record.updatedAt;
    const stale = ageMs > 5 * 60 * 1000;

    return NextResponse.json(
      { ...record.train, stale, lastUpdated: new Date(record.updatedAt).toISOString() },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error(`[/api/train/${trainNumber}]`, err);
    return NextResponse.json(
      { error: 'Internal error', retryAfter: 30 },
      { status: 503, headers: CORS_HEADERS }
    );
  }
}
