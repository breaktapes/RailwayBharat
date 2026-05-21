import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { redis, keys, setTrainLive, indexTrainAtStation } from '@/lib/redis/client';
import { NTESScraper } from '@/lib/scrapers/ntes';
import { RailYatriScraper } from '@/lib/scrapers/railyatri';
import { fetchWithFallback } from '@/lib/scrapers';
import { isScraperError } from '@/types';
import { supabase } from '@/lib/supabase/client';
import type { DbStation } from '@/lib/supabase/client';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(request: NextRequest) {
  // Verify QStash HMAC signature
  const signature = request.headers.get('upstash-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const body = await request.text();
  const isValid = await receiver.verify({
    signature,
    body,
  }).catch(() => false);

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { batch, chunk } = JSON.parse(body) as { batch: number; chunk: number };

  // Load the chunk's train numbers from Redis
  const trainNumbers = await redis.get<string[]>(keys.cronBatchChunk(batch, chunk));
  if (!trainNumbers) {
    return NextResponse.json({ error: 'Chunk not found', batch, chunk }, { status: 404 });
  }

  // Load station coordinates for lat/lng lookup
  const { data: stations } = await supabase
    .from('stations')
    .select('station_code, lat, lng')
    .not('lat', 'is', null);

  const coordMap = new Map<string, { lat: number; lng: number }>(
    (stations ?? [])
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => [s.station_code as string, { lat: s.lat as number, lng: s.lng as number }])
  );

  const primaryScraper = new NTESScraper(coordMap);
  const fallbackScraper = new RailYatriScraper(coordMap);

  let successes = 0;
  let errors = 0;
  let notFound = 0;

  for (const trainNumber of trainNumbers) {
    const result = await fetchWithFallback(trainNumber, primaryScraper, fallbackScraper);

    if (result === null) {
      notFound++;
      continue;
    }

    if (isScraperError(result)) {
      errors++;
      if (result.type === 'rate_limit') {
        // Back off and stop this chunk — don't burn more rate limit
        console.warn(`[scrape/chunk] rate limited on ${trainNumber}, stopping chunk early`);
        break;
      }
      console.warn(`[scrape/chunk] ${result.type} for ${trainNumber}: ${result.message}`);
      continue;
    }

    await setTrainLive(result);

    // Index at current station using scheduled dep time as score
    // Use current time as fallback since we may not have scheduled dep in live data
    await indexTrainAtStation(
      result.currentStationCode,
      result.trainNumber,
      Math.floor(Date.now() / 1000)
    );

    successes++;
  }

  console.log(`[scrape/chunk] batch=${batch} chunk=${chunk}: ${successes} ok, ${errors} errors, ${notFound} not-running`);
  return NextResponse.json({ successes, errors, notFound });
}
