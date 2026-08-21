-- backend/sql/20260821-service-order-reception-checklist.sql
-- P3.1: checklist de recepción del equipo por orden de servicio.
-- Ejecutar UNA sola vez. Es idempotente y no borra datos existentes.

BEGIN;

CREATE TABLE IF NOT EXISTS service_order_reception_checklists (
  id UUID PRIMARY KEY,
  service_order_id UUID NOT NULL UNIQUE,
  technician_id UUID NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'draft',

  equipment_type VARCHAR(150) NULL,
  brand VARCHAR(120) NULL,
  model VARCHAR(120) NULL,
  serial_number VARCHAR(160) NULL,

  received_from_name VARCHAR(180) NULL,
  received_from_document VARCHAR(80) NULL,

  condition_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  accessories JSONB NOT NULL DEFAULT '{}'::jsonb,
  accessories_other TEXT NULL,
  observations TEXT NULL,

  latitude NUMERIC(10, 7) NULL,
  longitude NUMERIC(10, 7) NULL,
  accuracy_m NUMERIC(10, 2) NULL,
  location_captured_at TIMESTAMPTZ NULL,

  confirmed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT service_order_reception_checklists_order_fk
    FOREIGN KEY (service_order_id)
    REFERENCES service_orders(id)
    ON DELETE CASCADE,

  CONSTRAINT service_order_reception_checklists_tech_fk
    FOREIGN KEY (technician_id)
    REFERENCES usuarios(id)
    ON DELETE RESTRICT,

  CONSTRAINT service_order_reception_checklists_status_chk
    CHECK (status IN ('draft', 'confirmed')),

  CONSTRAINT service_order_reception_checklists_lat_chk
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),

  CONSTRAINT service_order_reception_checklists_long_chk
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),

  CONSTRAINT service_order_reception_checklists_accuracy_chk
    CHECK (accuracy_m IS NULL OR accuracy_m >= 0),

  CONSTRAINT service_order_reception_checklists_condition_object_chk
    CHECK (jsonb_typeof(condition_flags) = 'object'),

  CONSTRAINT service_order_reception_checklists_accessories_object_chk
    CHECK (jsonb_typeof(accessories) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_reception_checklists_technician
  ON service_order_reception_checklists (technician_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_reception_checklists_status
  ON service_order_reception_checklists (status, updated_at DESC);

COMMIT;
