-- backend/sql/20260821-location-integrity.sql
-- P4.1 · Integridad de ubicación / señales anti-spoof.
-- Idempotente y no destructivo. No elimina ubicaciones previas.

BEGIN;

ALTER TABLE user_current_locations
  ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS integrity_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS integrity_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS movement_speed_kmh NUMERIC(10,2) NULL,
  ADD COLUMN IF NOT EXISTS network_changed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_timezone VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS client_platform VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS client_language VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS client_connection_type VARCHAR(40) NULL;

ALTER TABLE user_location_history
  ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS integrity_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS integrity_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS movement_speed_kmh NUMERIC(10,2) NULL,
  ADD COLUMN IF NOT EXISTS network_changed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_timezone VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS client_platform VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS client_language VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS client_connection_type VARCHAR(40) NULL;

CREATE TABLE IF NOT EXISTS user_location_integrity_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  latitude NUMERIC(10,7) NULL,
  longitude NUMERIC(10,7) NULL,
  accuracy_m NUMERIC(10,2) NULL,
  movement_speed_kmh NUMERIC(10,2) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  captured_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_location_integrity_events_user_fk
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT user_location_integrity_events_score_chk
    CHECK (risk_score BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_user_location_integrity_events_user_created
  ON user_location_integrity_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_location_integrity_events_risk
  ON user_location_integrity_events (risk_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_current_locations_integrity
  ON user_current_locations (integrity_status, integrity_score, received_at DESC);

COMMIT;
