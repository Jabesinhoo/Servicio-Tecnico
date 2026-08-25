-- V6 · Seguridad de red + dispositivo + geocerca + eventos de visita.
-- Idempotente y no destructivo.
BEGIN;

ALTER TABLE user_current_locations
  ADD COLUMN IF NOT EXISTS precision_tier VARCHAR(20) NOT NULL DEFAULT 'precise',
  ADD COLUMN IF NOT EXISTS network_trust_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS network_provider VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS network_proxy BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_vpn BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_tor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_hosting BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_fraud_score NUMERIC(6,2) NULL,
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS device_trust_status VARCHAR(20) NOT NULL DEFAULT 'unknown';

ALTER TABLE user_location_history
  ADD COLUMN IF NOT EXISTS precision_tier VARCHAR(20) NOT NULL DEFAULT 'precise',
  ADD COLUMN IF NOT EXISTS network_trust_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS network_provider VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS network_proxy BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_vpn BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_tor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_hosting BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS network_fraud_score NUMERIC(6,2) NULL,
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS device_trust_status VARCHAR(20) NOT NULL DEFAULT 'unknown';

CREATE TABLE IF NOT EXISTS user_location_devices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  device_id VARCHAR(100) NOT NULL,
  trust_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  platform VARCHAR(100) NULL,
  user_agent TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ NULL,
  approved_by UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ NULL,
  UNIQUE(user_id, device_id),
  CONSTRAINT user_location_devices_status_chk
    CHECK (trust_status IN ('trusted','pending','revoked'))
);

CREATE INDEX IF NOT EXISTS idx_user_location_devices_user
  ON user_location_devices(user_id, trust_status, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS service_order_geofences (
  service_order_id UUID PRIMARY KEY REFERENCES service_orders(id) ON DELETE CASCADE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  radius_m NUMERIC(10,2) NOT NULL DEFAULT 150,
  created_by UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_order_geofence_lat_chk CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT service_order_geofence_lon_chk CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT service_order_geofence_radius_chk CHECK (radius_m BETWEEN 25 AND 2000)
);

CREATE TABLE IF NOT EXISTS service_order_visit_events (
  id UUID PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  tecnico_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL,
  latitude NUMERIC(10,7) NULL,
  longitude NUMERIC(10,7) NULL,
  accuracy_m NUMERIC(10,2) NULL,
  distance_to_target_m NUMERIC(12,2) NULL,
  network_trust_status VARCHAR(20) NULL,
  device_trust_status VARCHAR(20) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_order_visit_event_type_chk
    CHECK (event_type IN ('en_camino','llegada_validada'))
);

CREATE INDEX IF NOT EXISTS idx_service_order_visit_events_order
  ON service_order_visit_events(service_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_order_visit_events_tech
  ON service_order_visit_events(tecnico_id, created_at DESC);

COMMIT;
