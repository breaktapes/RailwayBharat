import { NextRequest, NextResponse } from 'next/server';
import { parseIRCTCBooking } from '@/lib/passport/parser';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json() as { text: string };
    if (!text || typeof text !== 'string' || text.length > 5000) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const parsed = parseIRCTCBooking(text);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Parse failed' }, { status: 400 });
  }
}
