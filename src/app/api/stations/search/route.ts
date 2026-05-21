import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([], { headers: CORS });

  const { data, error } = await supabase
    .from('stations')
    .select('station_code, station_name, state')
    .or(`station_name.ilike.%${q}%,station_code.ilike.${q}%`)
    .limit(8);

  if (error) return NextResponse.json([], { headers: CORS });
  return NextResponse.json(data ?? [], { headers: CORS });
}
