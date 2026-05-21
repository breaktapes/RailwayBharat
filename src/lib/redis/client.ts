import { Redis } from '@upstash/redis';
import type { LiveTrain } from '@/types';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Key schema
export const keys = {
  cronLock: 'cron:lock',
  activeTrains: 'cron:active-trains',
  cronBatchChunk: (ts: number, n: number) => `cron:batch:${ts}:chunk:${n}`,
  trainLive: (trainNumber: string) => `train:live:${trainNumber}`,
  stationIndex: (stationCode: string) => `station:index:${stationCode}`,
};

export const TTL = {
  CRON_LOCK: 110, // seconds — must be < cron interval (120s)
  ACTIVE_TRAINS: 240, // 2× cron interval, survives one missed run
  TRAIN_LIVE: 120, // matches cron interval
};

export async function getTrainLive(trainNumber: string): Promise<{ train: LiveTrain; updatedAt: number } | null> {
  const data = await redis.get<{ train: LiveTrain; updatedAt: number }>(
    keys.trainLive(trainNumber)
  );
  return data ?? null;
}

export async function setTrainLive(train: LiveTrain): Promise<void> {
  await redis.set(
    keys.trainLive(train.trainNumber),
    { train, updatedAt: Date.now() },
    { ex: TTL.TRAIN_LIVE }
  );
}

/** Returns all active train live records from the index. */
export async function getAllLiveTrains(): Promise<{ train: LiveTrain; updatedAt: number }[]> {
  const trainNumbers = await redis.smembers(keys.activeTrains);
  if (trainNumbers.length === 0) return [];

  const trainKeys = trainNumbers.map((n) => keys.trainLive(n));
  // MGET returns null for missing keys
  const results = await redis.mget<({ train: LiveTrain; updatedAt: number } | null)[]>(...trainKeys);
  return results.filter((r): r is { train: LiveTrain; updatedAt: number } => r !== null);
}

export async function acquireCronLock(): Promise<boolean> {
  // SET NX EX — atomic: only sets if key doesn't exist
  const result = await redis.set(keys.cronLock, '1', { nx: true, ex: TTL.CRON_LOCK });
  return result === 'OK';
}

/** Adds train numbers to the active-trains index and resets the TTL. */
export async function setActiveTrains(trainNumbers: string[]): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.del(keys.activeTrains);
  if (trainNumbers.length > 0) {
    pipeline.sadd(keys.activeTrains, trainNumbers[0], ...trainNumbers.slice(1));
    pipeline.expire(keys.activeTrains, TTL.ACTIVE_TRAINS);
  }
  await pipeline.exec();
}

/**
 * Adds a train to the station departure index.
 * Score = scheduled departure unix timestamp (used for range queries and expiry).
 */
export async function indexTrainAtStation(
  stationCode: string,
  trainNumber: string,
  scheduledDepUnix: number
): Promise<void> {
  const key = keys.stationIndex(stationCode);
  const nowMinus2h = Math.floor(Date.now() / 1000) - 7200;

  const pipeline = redis.pipeline();
  // Remove entries older than 2 hours
  pipeline.zremrangebyscore(key, 0, nowMinus2h);
  // Add/update this train
  pipeline.zadd(key, { score: scheduledDepUnix, member: trainNumber });
  await pipeline.exec();
}

/**
 * Gets trains departing from a station in the next windowSeconds seconds.
 * Default: 3 hours (10800s).
 */
export async function getStationDepartures(
  stationCode: string,
  windowSeconds = 10800
): Promise<string[]> {
  const now = Math.floor(Date.now() / 1000);
  const until = now + windowSeconds;
  return redis.zrange(keys.stationIndex(stationCode), now, until, { byScore: true }) as Promise<string[]>;
}
