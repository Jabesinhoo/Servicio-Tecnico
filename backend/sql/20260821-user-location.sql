-- backend/sql/20260821-user-location.sql
-- Ejecutar UNA sola vez sobre PostgreSQL. Es idempotente.
-- No elimina ni modifica datos existentes de usuarios.

BEGIN;

CREATE TABLE IF NOT EXISTS user_current_locations (
  user_id UUID PRIMARY KEY,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  accuracy_m NUMERIC(10, 2) NOT NULL,
  altitude_m NUMERIC(10, 2) NULL,
  altitude_accuracy_m NUMERIC(10, 2) NULL,
  heading_deg NUMERIC(6, 2) NULL,
  speed_mps NUMERIC(10, 3) NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'browser_geolocation',
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_current_locations_user_fk
    FOREIGN KEY (user_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,
  CONSTRAINT user_current_locations_latitude_chk
    CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT user_current_locations_longitude_chk
    CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT user_current_locations_accuracy_chk
    CHECK (accuracy_m >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_current_locations_received_at
  ON user_current_locations (received_at DESC);

CREATE TABLE IF NOT EXISTS user_location_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  accuracy_m NUMERIC(10, 2) NOT NULL,
  altitude_m NUMERIC(10, 2) NULL,
  altitude_accuracy_m NUMERIC(10, 2) NULL,
  heading_deg NUMERIC(6, 2) NULL,
  speed_mps NUMERIC(10, 3) NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'browser_geolocation',
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_location_history_user_fk
    FOREIGN KEY (user_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,
  CONSTRAINT user_location_history_latitude_chk
    CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT user_location_history_longitude_chk
    CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT user_location_history_accuracy_chk
    CHECK (accuracy_m >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_location_history_user_captured
  ON user_location_history (user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_location_history_created_at
  ON user_location_history (created_at DESC);

COMMIT;
