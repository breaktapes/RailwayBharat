import { NextResponse } from 'next/server';
import { redis, keys, acquireCronLock, setActiveTrains } from '@/lib/redis/client';
import { supabase, trainRunsToday } from '@/lib/supabase/client';
import { Client } from '@upstash/qstash';

const CHUNK_SIZE = 50;
const QSTASH_TOKEN = process.env.QSTASH_TOKEN!;
const APP_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.APP_URL ?? 'http://localhost:3000';

export async function GET(request: Request) {
  // Vercel Cron authentication
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Cron concurrency lock — skip if previous run still in progress
  const locked = await acquireCronLock();
  if (!locked) {
    console.warn('[cron/refresh] skipped — previous run still in progress (lock held)');
    return NextResponse.json({ skipped: true, reason: 'lock_held' });
  }

  const today = new Date();

  // Query Supabase for trains running today
  const { data: trains, error } = await supabase
    .from('trains')
    .select('train_number, runs_on')
    .order('train_number');

  if (error) {
    console.error('[cron/refresh] Supabase error', error);
    return NextResponse.json({ error: 'Supabase query failed' }, { status: 500 });
  }

  const activeTrainNumbers = (trains ?? [])
    .filter((t) => trainRunsToday(t.runs_on, today))
    .map((t) => t.train_number);

  if (activeTrainNumbers.length === 0) {
    return NextResponse.json({ chunks: 0, trains: 0 });
  }

  // Update the active-trains index
  await setActiveTrains(activeTrainNumbers);

  // Chunk into batches of CHUNK_SIZE
  const timestamp = Date.now();
  const chunks: string[][] = [];
  for (let i = 0; i < activeTrainNumbers.length; i += CHUNK_SIZE) {
    chunks.push(activeTrainNumbers.slice(i, i + CHUNK_SIZE));
  }

  // Write chunks to Redis
  const pipeline = redis.pipeline();
  chunks.forEach((chunk, n) => {
    pipeline.set(keys.cronBatchChunk(timestamp, n), JSON.stringify(chunk), { ex: 300 });
  });
  await pipeline.exec();

  // Dispatch via QStash
  const qstash = new Client({ token: QSTASH_TOKEN });
  await Promise.all(
    chunks.map((_, n) =>
      qstash.publishJSON({
        url: `${APP_URL}/api/scrape/chunk`,
        body: { batch: timestamp, chunk: n },
      })
    )
  );

  console.log(`[cron/refresh] dispatched ${chunks.length} chunks for ${activeTrainNumbers.length} trains`);
  return NextResponse.json({ chunks: chunks.length, trains: activeTrainNumbers.length });
}
