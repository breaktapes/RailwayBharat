-- RailwayBharat static master data schema

CREATE TABLE stations (
  id SERIAL PRIMARY KEY,
  station_code VARCHAR(10) NOT NULL UNIQUE,
  station_name VARCHAR(200) NOT NULL,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  zone VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stations_code ON stations(station_code);
CREATE INDEX idx_stations_name ON stations(station_name);

CREATE TABLE trains (
  id SERIAL PRIMARY KEY,
  train_number VARCHAR(10) NOT NULL UNIQUE,
  train_name VARCHAR(200) NOT NULL,
  from_station VARCHAR(10) NOT NULL REFERENCES stations(station_code),
  to_station VARCHAR(10) NOT NULL REFERENCES stations(station_code),
  -- 7-bit bitmask: bit 0 = Sunday, bit 1 = Monday, ..., bit 6 = Saturday
  -- e.g. runs Mon+Fri = 0b0100010 = 34
  runs_on SMALLINT NOT NULL DEFAULT 127, -- 127 = 0b1111111 = runs every day
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trains_number ON trains(train_number);
CREATE INDEX idx_trains_name ON trains(train_name);
CREATE INDEX idx_trains_runs_on ON trains(runs_on);

CREATE TABLE train_schedule (
  id SERIAL PRIMARY KEY,
  train_id INTEGER NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL, -- stop sequence number (1 = origin)
  arr_time VARCHAR(5), -- HH:MM, null for origin
  dep_time VARCHAR(5), -- HH:MM, null for terminus
  distance_km INTEGER,
  platform VARCHAR(10),
  UNIQUE(train_id, seq),
  UNIQUE(train_id, station_id)
);

CREATE INDEX idx_schedule_train ON train_schedule(train_id);
CREATE INDEX idx_schedule_station ON train_schedule(station_id);
