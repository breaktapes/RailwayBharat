import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

interface SubscribeBody {
  deviceId: string;
  type: 'train_platform' | 'train_delay' | 'station_departure';
  targetId: string;
  delayThreshold?: number;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SubscribeBody;
    const { deviceId, type, targetId, delayThreshold, subscription } = body;

    if (!deviceId || !type || !targetId || !subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert on push_endpoint (one subscription record per endpoint+target)
    const { error } = await supabase.from('alert_subscriptions').upsert(
      {
        device_id: deviceId,
        type,
        target_id: targetId,
        delay_threshold: delayThreshold ?? null,
        push_endpoint: subscription.endpoint,
        push_keys: subscription.keys,
      },
      { onConflict: 'push_endpoint' }
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/alerts/subscribe]', err);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json() as { endpoint: string };
    await supabase.from('alert_subscriptions').delete().eq('push_endpoint', endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/alerts/subscribe DELETE]', err);
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 });
  }
}
