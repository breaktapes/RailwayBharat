-- Journey Passport: stores user trip history per device (no auth required)

CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL, -- anonymous device ID stored in localStorage
  train_number VARCHAR(10) NOT NULL,
  train_name VARCHAR(200),
  journey_date DATE NOT NULL,
  from_station VARCHAR(10) NOT NULL,
  from_station_name VARCHAR(200),
  to_station VARCHAR(10) NOT NULL,
  to_station_name VARCHAR(200),
  coach VARCHAR(10), -- e.g. "B2", "S5", "1A"
  pnr VARCHAR(15),
  delay_minutes INTEGER DEFAULT 0,
  distance_km INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_journeys_device ON journeys(device_id);
CREATE INDEX idx_journeys_date ON journeys(journey_date DESC);

-- Web Push alert subscriptions

CREATE TABLE alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('train_platform', 'train_delay', 'station_departure')),
  target_id VARCHAR(20) NOT NULL, -- trainNumber or stationCode
  delay_threshold INTEGER, -- minutes, for train_delay type
  push_endpoint TEXT NOT NULL UNIQUE,
  push_keys JSONB NOT NULL, -- {p256dh: string, auth: string}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_device ON alert_subscriptions(device_id);
CREATE INDEX idx_alerts_target ON alert_subscriptions(target_id);

-- Row-level security: devices can only read/write their own records
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies use device_id header (passed as x-device-id from client)
-- In practice we trust the client device_id for anonymous access
CREATE POLICY "device owns journeys"
  ON journeys FOR ALL
  USING (device_id::text = current_setting('request.headers', true)::json->>'x-device-id');

CREATE POLICY "device owns subscriptions"
  ON alert_subscriptions FOR ALL
  USING (device_id::text = current_setting('request.headers', true)::json->>'x-device-id');
