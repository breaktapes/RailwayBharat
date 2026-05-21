<!-- /autoplan restore point: /Users/akrish/.gstack/projects/RailwayBharat_DEV/unknown-autoplan-restore-20260521-124818.md -->

# RailwayBharat — Real-Time Indian Railways Train Tracker

## Overview

Build a public, open-source web application that tracks all Indian Railways trains in real time. Live positions on a map of India, delay status, station-by-station progress, and departure boards for any station. The differentiator: open source, beautifully designed, web-first, public developer API — unlike every existing commercial alternative (RailYatri, IndiaRailInfo, ixigo which are all proprietary or ugly).

Design doc: `~/.gstack/projects/RailwayBharat_DEV/akrish-unknown-design-20260521-125958.md` (APPROVED)

## Stack

- **Frontend**: Next.js 15 + TypeScript, App Router
- **Styling**: Tailwind CSS + shadcn/ui
- **Map (primary)**: deck.gl (ScatterplotLayer) + react-map-gl + Carto Dark / OpenStreetMap tiles — free, OSS, handles 1000+ animated markers at 60fps via WebGL
- **Map (fallback)**: Leaflet + OpenStreetMap canvas rendering — for devices where WebGL fails (mid-range Android <Snapdragon 665)
- **State/fetching**: React Query (polling every 120s)
- **Cache**: Upstash Redis (position cache, TTL 120s)
- **Queue/fan-out**: Upstash QStash ($10/mo plan — free tier insufficient, see Architecture)
- **Database**: Supabase (PostgreSQL) — static master data (trains, stations, routes, `runs_on` schedule bitmask)
- **Scraping**: Axios + Cheerio, NTES + RailYatri undocumented JSON endpoints
- **Deployment**: Vercel + Vercel Cron (triggers every 2min)

## Data Sources

- **NTES** (`enquiry.indianrail.gov.in`) — official Indian Railways enquiry; undocumented AJAX endpoints
- **RailYatri** (`railyatri.in`) — popular third-party aggregator; undocumented REST API
- Both scraped server-side (avoids CORS, enables caching and rate-limiting)
- Fallback: if primary fails, try secondary. If both fail, serve stale Redis cache with `stale: true` flag

## Key Features

### 1. Homepage — Live Map
- deck.gl ScatterplotLayer on dark Carto tile base
- ~500 running trains as animated dots (4px→7px pulse, 2s keyframe, requestAnimationFrame loop)
- Color-coded: green = on time, yellow = <30min late, red = >30min late
- Click dot → train popover: name, number, current station, delay, next 3 stops
- Floating search bar, live train count badge, refresh timestamp
- Polls `/api/trains/live` every 120s

### 2. Train Search
- Search by train number or name (fuzzy match on Supabase master data)
- Autocomplete dropdown → links to train detail page

### 3. Train Detail Page (`/train/[trainNumber]`)
- Progress bar (stations passed / total)
- Full station table: name | scheduled | actual | delay | status
- Current station highlighted
- Polls `/api/train/[id]` every 120s

### 4. Station Board (`/station/[stationCode]`)
- Departures and arrivals for next 3 hours
- Aggregated from Redis `station:index:{stationCode}` sorted set
- Polls every 120s

### 5. Saved Trains/Stations
- localStorage-backed (no server, no auth)
- ★ tap on any train/station → saved to `localStorage['rb:favorites']`
- Saved tab shows list, taps through to detail pages

### 6. Embeddable Widget
- `<iframe src="https://railwaybharat.in/embed/train/[trainId]" />` 
- Returns self-contained HTML: train name, current station, delay badge, next 2 stops
- CORS-open, CDN-cached 60s (`Cache-Control: public, max-age=60, s-maxage=60`)
- Rate-limited: 100 req/min per IP via Vercel Edge Middleware

## Architecture

```
[Client Browser]
    ├── deck.gl ScatterplotLayer (animated train dots, pulsing)
    │   └── Leaflet fallback if WebGL unavailable
    ├── react-map-gl + Carto Dark tiles
    └── React Query (polls every 120s)
              │
[Next.js API Routes on Vercel]
    ├── /api/trains/live      → {trains: LiveTrain[], lastUpdated, stale: bool, count}
    ├── /api/train/[id]       → LiveTrainDetail | 503 {retryAfter: 30}
    ├── /api/station/[code]   → StationBoard (from Redis sorted set)
    ├── /api/embed/[trainId]  → iframe HTML (CORS-open, CDN-cached 60s)
    └── /api/cron/refresh     → writes batch to Redis, triggers QStash chunks
              │
              ├── QStash fan-out → 10× /api/scrape/chunk?batch={id}&chunk={n}
              │     Each chunk: 50 trains, ~8s per invocation (within Vercel 10s limit)
              │
              ├── Upstash Redis (TTL 120s)
              │     train:live:{number}         → LiveTrain JSON
              │     station:index:{stationCode}  → sorted set (score = dep time unix)
              │
              └── ScraperTransport interface
                    NTESScraper (primary)
                    RailYatriScraper (fallback)
                    ProxiedTransport (wrapper if IP blocking >20%)

[Supabase]
    trains(id, train_number, train_name, from_station, to_station, runs_on bitmask)
    stations(id, station_code, station_name, lat, lng, zone)
    train_schedule(id, train_id, station_id, seq, arr_time, dep_time, distance_km)
```

### CORS Policy
`/api/trains/live`, `/api/train/[id]`, `/api/station/[code]`, `/api/embed/[trainId]`: all expose `Access-Control-Allow-Origin: *` (read-only public data, no auth).

### Cron Fan-out Detail
- Vercel free tier: 10s function execution limit
- Solution: `/api/cron/refresh` queries Supabase for today's active trains (~500, using `runs_on` bitmask), writes 10 chunks of 50 train numbers to Redis (`cron:batch:{ts}:chunk:{n}`)
- QStash delivers 10 parallel HTTP POSTs to `/api/scrape/chunk` — each scrapes 50 trains in <10s
- **QStash $10/mo plan required** (free tier = 500 msg/day; need ~7,200 msg/day)

### Graceful Degradation
- If Redis has data beyond TTL: serve it with `stale: true`
- If Redis is empty: return `{trains: [], stale: true, lastUpdated: null}`
- UI: amber banner "Data delayed — last updated N min ago" when `stale: true`
- Never blank map — last known positions always shown

### Scraper Transport Interface
```ts
interface ScraperTransport {
  fetchTrainStatus(trainNumber: string): Promise<LiveTrain | null>;
}
// NTESScraper and RailYatriScraper implement this.
// ProxiedTransport(inner, proxyPool) wraps either for IP rotation.
```

## Static Data

- Supabase seeded from data.gov.in Indian Railways open datasets
- Station GPS: ~8,000 of ~8,500 stations expected to have coords (5km tolerance acceptable)
- `runs_on` bitmask: 7-bit field (Mon-Sun), used to filter active trains per cron run
- Train schedule: arr_time/dep_time stored as HH:MM strings

## Error Handling

- Both scrapers fail → stale Redis cache served with `stale: true`; UI shows amber banner
- Redis miss (cache cold or expired) → `503 {retryAfter: 30}` on single-train endpoint; `/api/trains/live` returns empty array with `stale: true`
- NTES rate limit → exponential backoff in NTESScraper, switch to RailYatriScraper
- Bad/unparseable scrape response → log to Vercel logs, skip that train, continue batch

## Performance Targets

- Map load (deck.gl + 500 dots): <2s on 4G
- Train position refresh: every 120s (matches cron interval)
- API response time: <100ms (Redis hit), <2s (scraper fallback)
- Widget load: <2s (CDN-cached)
- Map FPS: 60fps on Chrome/Android 10/Snapdragon 665; Leaflet fallback on older devices

## Out of Scope (v1)

- ML delay prediction (needs months of historical data first)
- User accounts / cloud-synced saved trains
- Native iOS/Android app
- Community layer (crowdsourced train reports)
- Historical route playback
- Push notifications
- Booking / PNR status integration

## Implementation Phases

### Phase 1 — Foundation + Data Validation
- `git init`, create Next.js 15 project
- Set up Supabase schema + seed static data from data.gov.in
- Build NTESScraper + RailYatriScraper (ScraperTransport interface)
- **Run scraper 72 hours — validate block rate <5% before proceeding**
- Set up Upstash Redis + QStash, build cron fan-out

### Phase 2 — Core APIs
- `/api/trains/live`, `/api/train/[id]`, `/api/station/[code]`
- Cron fan-out + chunked scraping pipeline
- Graceful degradation (stale flag, amber banner)

### Phase 3 — Frontend
- deck.gl map with train dots + animation
- Leaflet fallback (WebGL detection)
- Search component + autocomplete
- Train detail page
- Station board

### Phase 4 — Polish + Distribution
- Saved tab (localStorage favorites)
- Embeddable iframe widget
- Mobile responsive QA (Android 10 target device)
- README + architecture diagram
- Deploy, post on r/india, r/IndianRailways, HN

## Infrastructure Costs

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Vercel | Free (Hobby) | $0 |
| Supabase | Free | $0 |
| Upstash Redis | Free (10k cmd/day) | $0 |
| Upstash QStash | Pay-as-you-go | ~$10/mo |
| Mapbox/Carto tiles | Free (OSM tiles) | $0 |
| **Total** | | **~$10/mo** |

## Design Spec (added by Phase 2 Design Review)

### Navigation
- Bottom nav: 56px height + `safe-area-inset-bottom` padding (iPhone notch + Android gesture bar)
- Active tab indicator: filled circle above tab icon, `#e94560` red accent
- "More" tab replaced with "About" (single page: project description, GitHub link, public API docs link)

### Typography
- Train numbers: monospace (`font-mono`), gray-400
- Train names: 24px bold on detail page header
- Delay badge: pill shape, 8px border-radius, color-filled background, white text — format: "15 min late" or "On time"
- Use Indian Railways vocabulary: "PF 3" for platform, "ARR"/"DEP" for arrival/departure

### Touch Targets
- All interactive elements: 44×44px minimum
- Map train dots: not keyboard-accessible (WebGL constraint — acceptable); keyboard users directed to search-first flow

### Mobile: Train Popover
- Desktop: floating card (320px wide) above clicked dot
- Mobile: bottom sheet, slides up to 40% screen height, dismisses on downward swipe or tap-outside

### Empty States (every screen)
- **Map cold start** (Redis empty): map renders with zero dots + amber banner "Live data loading — check back in 2 minutes" + spinner. Never blank.
- **Saved tab empty**: centered illustration, "No saved trains yet", subtext "Tap ★ on any train or station to save it here"
- **Station board: no departures**: "No trains departing from [STATION] in the next 3 hours"
- **Search: no results**: "No trains matching '[query]'. Try a train number (e.g. 12301) or partial name."
- **Train detail: 503 scraper down**: "Live data unavailable right now. Try again in [retryAfter]s." with last-known station shown if stale cache available

### Interaction States
- Search autocomplete: max 5 results, keyboard-navigable (↑↓ arrow keys), Escape clears
- Station board rows: tap → navigate to `/train/[number]`
- All data-loading screens: skeleton shimmer (gray-700 → gray-600 pulse) while polling
- Train detail polling: subtle spinner on last-updated timestamp while refreshing

### Accessibility
- Delay status: color + text badge (never color alone — colorblind-safe)
- Search: `aria-label="Search trains by name or number"`
- Bottom nav items: `aria-label` on each tab
- Train popover close button: `aria-label="Close train details"`
- Target WCAG AA contrast for all text elements

### Stale Data Copy
- Banner text: "Trains last seen {N} min ago — refresh" (more human than "Data delayed")
- Refresh tap: re-triggers React Query manual invalidate

## Open Questions

1. **NTES block rate**: Validate empirically — run scraper 72h, measure. If >20% blocked, add ProxiedTransport with residential proxies.
2. **Station GPS gaps**: ~500 stations may lack coordinates. Accept at launch; crowdsource via GitHub issues.
3. **deck.gl fallback threshold**: If WebGL context creation fails or FPS <30 after 3s, auto-switch to Leaflet canvas silently.
4. **QStash alternative**: If QStash proves problematic, consider self-hosted BullMQ on a free Railway.app instance instead.

## Engineering Review Decisions (Phase 3 — autoplan)

### Architecture Amendments

**A1 — Cron lock** (anti-race):
- `/api/cron/refresh` acquires `cron:lock` key (TTL 110s) before dispatching QStash
- If lock exists, skip run and log warning. If lock acquired, proceed with fan-out.
- Prevents overlapping scrape batches if NTES is slow

**A2 — Station index TTL** (bounded sorted sets):
- `station:index:{stationCode}` sorted set: score = scheduled departure unix timestamp
- On each write: `ZREMRANGEBYSCORE station:index:{code} 0 {now-7200}` (remove entries >2h old)
- On each read: `ZRANGEBYSCORE station:index:{code} {now} {now+10800}` (next 3h only)
- No explicit key TTL needed — score IS the expiry window

**A3 — QStash signature verification**:
- `/api/scrape/chunk` verifies `upstash-signature` HMAC header using `@upstash/qstash` SDK
- Rejects all non-QStash requests with 401

**A4 — NTES session bootstrapping**:
- Each `/api/scrape/chunk` invocation: initial GET to NTES homepage to acquire session cookie
- Cookie held in-memory for that invocation's 50-train batch, discarded after
- ~200ms overhead per chunk, stateless by design

**A5 — Active trains index key**:
- Cron job writes `cron:active-trains` Redis Set (TTL 240s) with all active train numbers
- `/api/trains/live` reads from this index: `SMEMBERS cron:active-trains` → `MGET train:live:{n}...`
- Avoids `KEYS train:live:*` (O(all-keyspace), blocking)

### ScraperTransport Interface Amendment

```ts
type ScraperError = {
  type: 'rate_limit' | 'parse_error' | 'not_found' | 'network_error';
  retryAfter?: number;  // seconds, for rate_limit type
};

interface ScraperTransport {
  fetchTrainStatus(trainNumber: string): Promise<LiveTrain | ScraperError | null>;
}
// null = not found (train not running today, safe to skip)
// ScraperError = real error (log, handle retryAfter for rate_limit)
// LiveTrain = success
```

### Updated Redis Key Schema

```
cron:lock                           → string "1", TTL 110s (concurrency guard)
cron:active-trains                  → Set of train numbers, TTL 240s
cron:batch:{ts}:chunk:{n}          → List of 50 train numbers for QStash
train:live:{number}                 → LiveTrain JSON, TTL 120s
station:index:{stationCode}         → Sorted set (score=dep_unix), no TTL (managed by score)
```

### Test Plan

Framework: Vitest + Playwright (e2e)

```
Scrapers (unit, fixture-based):
  NTESScraper.fetchTrainStatus
    ✓ happy path → valid LiveTrain from fixture HTML
    ✓ 429 response → ScraperError{type:'rate_limit', retryAfter:60}
    ✓ malformed HTML → ScraperError{type:'parse_error'}
    ✓ network timeout → ScraperError{type:'network_error'}
  RailYatriScraper (same 4 cases)

API routes (unit, Redis/Supabase mocked):
  /api/trains/live
    ✓ Redis hit → 200 {trains, stale:false}
    ✓ Redis stale → 200 {trains, stale:true}
    ✓ Redis empty → 200 {trains:[], stale:true}
  /api/train/[id]
    ✓ Redis hit → 200 LiveTrain
    ✓ Redis miss + scraper ok → 200 + writes cache
    ✓ Redis miss + scraper fail → 503 {retryAfter:30}
  /api/station/[code]
    ✓ has upcoming trains → 200 StationBoard
    ✓ no upcoming trains → 200 {trains:[]}
  /api/cron/refresh
    ✓ no lock → writes chunks + dispatches QStash
    ✓ lock exists → skips, logs warning
  /api/scrape/chunk
    ✓ valid QStash signature → scrapes + writes Redis
    ✓ invalid signature → 401
    ✓ 50 trains, some null → writes successes, logs errors

Business logic (unit):
  runs_on bitmask
    ✓ Monday bitmask 0b1000000 → included Monday
    ✓ Monday bitmask 0b0111111 → excluded Monday
  stale detection
    ✓ < 5min old → stale:false
    ✓ > 5min old → stale:true
  station board ZRANGEBYSCORE
    ✓ filters past departures by score

Nightly integration test (hits real NTES, not in CI):
  ✓ fetchTrainStatus('12301') → response matches LiveTrain shape
  ✓ response time < 3000ms
```

## Design Review Summary (Phase 2 — autoplan)

Reviewed 2026-05-21. Visual mockups skipped ([openai-unavailable]). Wireframe from previous session used as visual reference. 7-dimension review complete.

**Scores:**
- Information Architecture: 7/10 — fixed "More" tab, search zero-state, 404 design
- Visual Hierarchy: 6/10 — fixed train name prominence, delay badge spec
- Interaction States: 4/10 — added skeleton loaders, search keyboard nav, popover dismiss, polling indicator
- Mobile/Responsive: 7/10 — fixed touch targets, bottom nav safe area, popover bottom sheet
- Accessibility: 3/10 → fixed with delay status dual-coding, ARIA labels, keyboard nav path
- Empty/Error States: 4/10 — defined all 5 missing states (cold start, saved empty, no departures, no results, 503)
- AI Slop Risk: 7/10 — added Indian Railways vocabulary, distinctive nav indicator

**Plan updated** with full Design Spec section above. Design completeness: 4/10 → 8/10.

## Eng Review Summary (Phase 3 — autoplan)

Reviewed 2026-05-21. 4 architecture issues + 2 code quality + 1 performance issue found and resolved.

**Architecture:** cron lock added, station index TTL strategy fixed, QStash auth added, NTES session bootstrap specified, active-trains index key added
**Code quality:** ScraperTransport interface amended to typed error result
**Tests:** full test plan written with fixture-based scraper tests + nightly integration test
**Performance:** active-trains index avoids O(all-keyspace) KEYS scan

Plan updated with Engineering Review Decisions section above. Architecture completeness: ~6/10 → 9/10.

## CEO Review Summary (Phase 1 — autoplan)

Reviewed 2026-05-21. [codex-unavailable] — Claude CEO voice only.

**Findings:**
- CRITICAL: Scraper survivability. NTES may block Vercel egress IP ranges at scale. 72h test validates rate limiting; does not validate structural IP blocking. Mitigation: ProxiedTransport interface already designed; proxy pool on standby.
- HIGH: Sustainability gap. No monetization path if proxy costs rise. Accepted: OSS projects tolerate this; GitHub sponsorship is the fallback.
- HIGH: Framing. "Public API" is the strategic asset; map is the demo. Accepted: headline can be adjusted at launch; architecture already builds the API.
- MEDIUM: WhereIsMyTrain reliability vs. RailwayBharat design. Not quantified. Accepted: design advantage validates through usage, not prior analysis.
- MEDIUM: IRCTC official API risk. If launched, scraping moat collapses; OSS positioning is the surviving moat. Accepted.

**Premise gate outcome**: All 5 premises accepted. Build proceeds.

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | Design | deck.gl over Mapbox GL JS | Mechanical | P4 (OSS-consistent) | Free, handles 1000+ markers, consistent with open-source positioning | Mapbox (usage-based cost at scale) |
| 2 | Design | Embeddable iframe widget | Mechanical | P1 (completeness) | Distribution channel built into product; no Indian rail tool has this | Script tag (XSS risk) |
| 3 | Design | QStash fan-out for cron | Mechanical | P5 (explicit) | Vercel 10s limit makes serial 500-train scrape impossible; fan-out is the only clean solution | Single cron invocation (infeasible), external server (more infrastructure) |
| 4 | Design | Leaflet fallback for WebGL | Mechanical | P1 (completeness) | ~20% of target devices can't sustain WebGL 60fps; blank screen is unacceptable | WebGL-only (excludes mid-range Android) |
| 5 | Design | localStorage for saved trains | Mechanical | P5 (explicit) | No user accounts in v1; localStorage is sufficient for personal favorites | Server-side (requires auth, out of scope) |
| 6 | CEO Review | Accept premises despite scraper survivability risk | Taste | P1 (completeness) | ProxiedTransport interface already in design; structural mitigation available if needed | Delay build pending proxy procurement (over-cautious) |
| 7 | Eng Review | Redis cron lock (TTL 110s) | Mechanical | P5 (explicit) | Prevents overlapping scrape batches when NTES is slow | No guard (last-writer-wins, acceptable but messy) |
| 8 | Eng Review | Station index managed by score cutoff, not key TTL | Mechanical | P1 (completeness) | Key TTL would blank the station board for up to 120s; score cutoff keeps data live | Key-level TTL (causes blank board on expiry) |
| 9 | Eng Review | QStash HMAC signature verification on /api/scrape/chunk | Mechanical | P2 (security) | Without verification, anyone can trigger mass scraping and burn NTES rate limit | Secret query param (weaker, logs-visible) |
| 10 | Eng Review | NTES session bootstrap per invocation (stateless) | Mechanical | P5 (explicit) | Vercel functions are stateless; per-invocation bootstrap is the only clean approach | Cache cookies in Redis (complex, fragile on expiry) |
| 11 | Eng Review | cron:active-trains index key instead of KEYS scan | Mechanical | P3 (performance) | KEYS is O(all-keyspace) and blocks Redis; index is O(active-trains) | SCAN-based (non-blocking but complex cursor management) |
| 12 | Eng Review | ScraperTransport typed error result (not null) | Mechanical | P1 (completeness) | null is ambiguous: swallows real errors silently; typed result enables retry logic | Thrown exceptions (relies on discipline across all implementations) |
| 13 | Eng Review | Fixture-based scraper tests (HTML snapshots) | Mechanical | P1 (completeness) | Only approach that tests HTML parsing; mocking fetch leaves the hardest code untested | Mock fetch only (leaves parser untested) |

## GSTACK REVIEW REPORT

**Status:** APPROVED 2026-05-21
**Phases completed:** CEO Review (Phase 1) + Design Review (Phase 2) + Eng Review (Phase 3)
**Decisions logged:** 13 (Decision Audit Trail above)
**Plan completeness:** Design 8/10, Architecture 9/10, Tests: full plan written

**Ready to build. Phase 1 next:**
1. `git init` + Next.js 15 scaffold
2. Supabase schema + seed static data (data.gov.in)
3. NTESScraper + RailYatriScraper (ScraperTransport interface with typed error result)
4. Run 72h scraper validation — block rate <5% required before Phase 2
