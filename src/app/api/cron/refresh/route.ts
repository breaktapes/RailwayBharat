import { NextResponse } from 'next/server';
import { redis, keys, acquireCronLock, setActiveTrains, setTrainLive, indexTrainAtStation } from '@/lib/redis/client';
import { supabase, trainRunsToday } from '@/lib/supabase/client';
import { fetchAllLiveTrains } from '@/lib/scrapers/railradar';
import { isScraperError } from '@/types';
import { Client as QStashClient } from '@upstash/qstash';
import { checkAndFireAlerts } from '@/lib/alerts/checker';

const CHUNK_SIZE = 50;
const QSTASH_TOKEN = process.env.QSTASH_TOKEN ?? '';
const APP_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.APP_URL ?? 'http://localhost:3000';

export async function GET(request: Request) {
  // Vercel Cron authentication
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Cron concurrency lock
  const locked = await acquireCronLock();
  if (!locked) {
    console.warn('[cron/refresh] skipped — lock held');
    return NextResponse.json({ skipped: true, reason: 'lock_held' });
  }

  // ─────────────────────────────────────────────────────────────
  // HAPPY PATH: RailRadar bulk fetch (single HTTP call, no fan-out)
  // ─────────────────────────────────────────────────────────────
  const liveMapResult = await fetchAllLiveTrains();

  if (Array.isArray(liveMapResult)) {
    const trains = liveMapResult;
    const trainNumbers = trains.map((t) => t.trainNumber);

    // Write all trains to Redis in a single pipeline
    const pipeline = redis.pipeline();
    const now = Math.floor(Date.now() / 1000);
    const nowMinus2h = now - 7200;

    for (const train of trains) {
      pipeline.set(
        keys.trainLive(train.trainNumber),
        JSON.stringify({ train, updatedAt: Date.now() }),
        { ex: 120 }
      );
      // Index at current station
      pipeline.zremrangebyscore(keys.stationIndex(train.currentStationCode), 0, nowMinus2h);
      pipeline.zadd(keys.stationIndex(train.currentStationCode), {
        score: now,
        member: train.trainNumber,
      });
    }

    pipeline.set(keys.cronLock, '1', { ex: 110 }); // noop — already acquired, refresh TTL
    await pipeline.exec();

    // Update active trains index
    await setActiveTrains(trainNumbers);

    // Record data source
    await redis.set('cron:source', 'railradar', { ex: 300 });

    // Check for platform/delay changes and fire push notifications
    await checkAndFireAlerts(trains);

    console.log(`[cron/refresh] railradar: ${trains.length} trains updated`);
    return NextResponse.json({ source: 'railradar', trains: trains.length });
  }

  const failedResult = liveMapResult as import('@/types').ScraperError;
  console.warn(`[cron/refresh] RailRadar failed (${failedResult.type}), falling back to NTES`);

  // ─────────────────────────────────────────────────────────────
  // FALLBACK PATH: QStash fan-out → NTES scraper chunks
  // ─────────────────────────────────────────────────────────────
  const today = new Date();
  const { data: dbTrains, error } = await supabase
    .from('trains')
    .select('train_number, runs_on')
    .order('train_number');

  if (error) {
    console.error('[cron/refresh] Supabase error', error);
    return NextResponse.json({ error: 'Supabase query failed' }, { status: 500 });
  }

  const activeTrainNumbers = (dbTrains ?? [])
    .filter((t) => trainRunsToday(t.runs_on, today))
    .map((t) => t.train_number);

  await setActiveTrains(activeTrainNumbers);

  const timestamp = Date.now();
  const chunks: string[][] = [];
  for (let i = 0; i < activeTrainNumbers.length; i += CHUNK_SIZE) {
    chunks.push(activeTrainNumbers.slice(i, i + CHUNK_SIZE));
  }

  const pipeline2 = redis.pipeline();
  chunks.forEach((chunk, n) => {
    pipeline2.set(keys.cronBatchChunk(timestamp, n), JSON.stringify(chunk), { ex: 300 });
  });
  await pipeline2.exec();

  if (QSTASH_TOKEN) {
    const qstash = new QStashClient({ token: QSTASH_TOKEN });
    await Promise.all(
      chunks.map((_, n) =>
        qstash.publishJSON({
          url: `${APP_URL}/api/scrape/chunk`,
          body: { batch: timestamp, chunk: n },
        })
      )
    );
  }

  await redis.set('cron:source', 'ntes', { ex: 300 });
  console.log(`[cron/refresh] ntes fallback: ${chunks.length} chunks for ${activeTrainNumbers.length} trains`);
  return NextResponse.json({ source: 'ntes_fallback', chunks: chunks.length, trains: activeTrainNumbers.length });
}
