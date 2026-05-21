import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const RAILRADAR_KEY = 'rr_prod_3cf4ebe1abdf49338c02f37a11f135d6';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from')?.toUpperCase();
  const to = searchParams.get('to')?.toUpperCase();

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to required' }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const response = await axios.get('https://api.railradar.in/api/v1/trains/between', {
      params: { from, to, apiKey: RAILRADAR_KEY },
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        Referer: 'https://railradar.in/',
      },
    });
    return NextResponse.json(response.data, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[/api/between]', err);
    return NextResponse.json({ error: 'Upstream error' }, { status: 502, headers: CORS_HEADERS });
  }
}
