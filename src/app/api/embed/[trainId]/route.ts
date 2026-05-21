import { NextRequest, NextResponse } from 'next/server';
import { getTrainLive } from '@/lib/redis/client';

const EMBED_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=60, s-maxage=60',
  'X-Frame-Options': 'ALLOWALL',
};

function delayColor(minutes: number): string {
  if (minutes === 0) return '#22c55e'; // green
  if (minutes < 30) return '#eab308'; // yellow
  return '#ef4444'; // red
}

function delayLabel(minutes: number): string {
  if (minutes === 0) return 'On time';
  return `${minutes} min late`;
}

function renderEmbed(
  trainNumber: string,
  trainName: string,
  currentStation: string,
  nextStation: string,
  delayMinutes: number,
  lastReported: string,
  stale: boolean
): string {
  const color = delayColor(delayMinutes);
  const label = delayLabel(delayMinutes);
  const reportedAt = new Date(lastReported).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1a1a2e;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .train-name { font-weight: 600; font-size: 14px; color: #f1f5f9; }
  .train-number { font-family: monospace; color: #94a3b8; font-size: 12px; }
  .delay-badge {
    background: ${color};
    color: white;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .stations { display: flex; flex-direction: column; gap: 4px; }
  .station-row { display: flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 12px; }
  .station-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; width: 36px; flex-shrink: 0; }
  .station-name { color: #e2e8f0; }
  .footer { margin-top: 8px; font-size: 10px; color: #475569; display: flex; justify-content: space-between; }
  .stale-indicator { color: #f59e0b; }
  a { color: #60a5fa; text-decoration: none; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="train-name">${escapeHtml(trainName)}</div>
      <div class="train-number">${escapeHtml(trainNumber)}</div>
    </div>
    <div class="delay-badge">${escapeHtml(label)}</div>
  </div>
  <div class="stations">
    <div class="station-row">
      <span class="station-label">At</span>
      <span class="station-name">${escapeHtml(currentStation)}</span>
    </div>
    <div class="station-row">
      <span class="station-label">Next</span>
      <span class="station-name">${escapeHtml(nextStation)}</span>
    </div>
  </div>
  <div class="footer">
    <span${stale ? ' class="stale-indicator"' : ''}>Last seen ${escapeHtml(reportedAt)} IST${stale ? ' (delayed)' : ''}</span>
    <a href="https://railwaybharat.in/train/${escapeHtml(trainNumber)}" target="_blank" rel="noopener">RailwayBharat ↗</a>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EMBED_CORS_HEADERS });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ trainId: string }> }
) {
  const { trainId } = await params;
  const trainNumber = trainId.toUpperCase();

  try {
    const record = await getTrainLive(trainNumber);

    if (!record) {
      const html = renderEmbed(
        trainNumber,
        trainNumber,
        'Data unavailable',
        '—',
        0,
        new Date().toISOString(),
        true
      );
      return new NextResponse(html, { status: 200, headers: EMBED_CORS_HEADERS });
    }

    const t = record.train;
    const stale = Date.now() - record.updatedAt > 5 * 60 * 1000;

    const html = renderEmbed(
      t.trainNumber,
      t.trainName,
      t.currentStation,
      t.nextStation,
      t.delayMinutes,
      t.lastReported,
      stale
    );

    return new NextResponse(html, { status: 200, headers: EMBED_CORS_HEADERS });
  } catch (err) {
    console.error(`[/api/embed/${trainNumber}]`, err);
    return new NextResponse('<p>Error loading train data</p>', {
      status: 500,
      headers: EMBED_CORS_HEADERS,
    });
  }
}
