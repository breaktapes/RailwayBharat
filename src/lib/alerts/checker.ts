import { redis } from '@/lib/redis/client';
import { supabase } from '@/lib/supabase/client';
import type { LiveTrain } from '@/types';
import webpush from 'web-push';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(
    'mailto:alerts@railwaybharat.in',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
}

interface AlertState {
  platform: string | null;
  delayMinutes: number;
}

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface AlertSubscription {
  id: string;
  device_id: string;
  type: 'train_platform' | 'train_delay' | 'station_departure';
  target_id: string; // trainNumber or stationCode
  delay_threshold?: number; // for train_delay type (minutes)
  push_endpoint: string;
  push_keys: { p256dh: string; auth: string };
}

async function getSubscriptionsForTrain(trainNumber: string): Promise<AlertSubscription[]> {
  const { data } = await supabase
    .from('alert_subscriptions')
    .select('*')
    .eq('target_id', trainNumber)
    .in('type', ['train_platform', 'train_delay']);
  return (data ?? []) as AlertSubscription[];
}

async function sendPush(sub: AlertSubscription, payload: object): Promise<void> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      { endpoint: sub.push_endpoint, keys: sub.push_keys } as PushSubscription,
      JSON.stringify(payload)
    );
  } catch (err) {
    console.warn(`[alerts] push failed for ${sub.id}:`, err);
    // Remove dead subscriptions (410 Gone = unsubscribed)
    if ((err as { statusCode?: number }).statusCode === 410) {
      await supabase.from('alert_subscriptions').delete().eq('id', sub.id);
    }
  }
}

/** Compares new train states against cached states and fires push notifications on changes. */
export async function checkAndFireAlerts(trains: LiveTrain[]): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  ensureVapid();

  const alertChecks = trains.map(async (train) => {
    const stateKey = `alert:state:${train.trainNumber}`;
    const prevState = await redis.get<AlertState>(stateKey);
    const newState: AlertState = {
      platform: null, // platform comes from detail endpoint; live-map doesn't include it
      delayMinutes: train.delayMinutes,
    };

    if (!prevState) {
      await redis.set(stateKey, newState, { ex: 300 });
      return;
    }

    const subs = await getSubscriptionsForTrain(train.trainNumber);
    const pushPromises: Promise<void>[] = [];

    // Delay threshold alerts
    const DELAY_THRESHOLDS = [30, 60];
    for (const threshold of DELAY_THRESHOLDS) {
      if (prevState.delayMinutes < threshold && train.delayMinutes >= threshold) {
        const delaySubs = subs.filter(
          (s) =>
            s.type === 'train_delay' &&
            (s.delay_threshold === undefined || s.delay_threshold <= threshold)
        );
        for (const sub of delaySubs) {
          pushPromises.push(
            sendPush(sub, {
              title: `${train.trainName} delayed ${train.delayMinutes} min`,
              body: `Currently at ${train.currentStation}, next stop ${train.nextStation}`,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/badge-72x72.png',
              data: { url: `/train/${train.trainNumber}` },
            })
          );
        }
      }
    }

    await Promise.all(pushPromises);
    await redis.set(stateKey, newState, { ex: 300 });
  });

  await Promise.allSettled(alertChecks);
}
