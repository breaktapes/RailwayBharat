import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([], { headers: CORS });

  // Search by train number prefix first, then train name contains
  const isNumeric = /^\d+$/.test(q);
  let query = supabase
    .from('trains')
    .select('train_number, train_name, from_station, to_station')
    .limit(5);

  if (isNumeric) {
    query = query.ilike('train_number', `${q}%`);
  } else {
    query = query.or(`train_name.ilike.%${q}%,train_number.ilike.${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json([], { headers: CORS });
  return NextResponse.json(data ?? [], { headers: CORS });
}
