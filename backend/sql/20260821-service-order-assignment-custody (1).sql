-- backend/sql/20260821-service-order-assignment-custody.sql
-- P2: aceptación del técnico + impedimento + custodia.
-- Ejecutar UNA vez sobre PostgreSQL.
-- Es idempotente: no borra órdenes ni usuarios existentes.

BEGIN;

CREATE TABLE IF NOT EXISTS service_order_assignments (
  id UUID PRIMARY KEY,
  service_order_id UUID NOT NULL,
  tecnico_id UUID NOT NULL,
  assigned_by UUID NULL,

  status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ NULL,

  impediment_reason TEXT NULL,
  acceptance_note TEXT NULL,

  response_latitude NUMERIC(10, 7) NULL,
  response_longitude NUMERIC(10, 7) NULL,
  response_accuracy_m NUMERIC(10, 2) NULL,
  response_location_captured_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT service_order_assignments_order_fk
    FOREIGN KEY (service_order_id)
    REFERENCES service_orders(id)
    ON DELETE CASCADE,

  CONSTRAINT service_order_assignments_tech_fk
    FOREIGN KEY (tecnico_id)
    REFERENCES usuarios(id)
    ON DELETE RESTRICT,

  CONSTRAINT service_order_assignments_assigned_by_fk
    FOREIGN KEY (assigned_by)
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  CONSTRAINT service_order_assignments_status_chk
    CHECK (
      status IN (
        'pendiente',
        'aceptada',
        'impedimento',
        'revocada'
      )
    ),

  CONSTRAINT service_order_assignments_response_lat_chk
    CHECK (
      response_latitude IS NULL
      OR response_latitude BETWEEN -90 AND 90
    ),

  CONSTRAINT service_order_assignments_response_long_chk
    CHECK (
      response_longitude IS NULL
      OR response_longitude BETWEEN -180 AND 180
    ),

  CONSTRAINT service_order_assignments_response_accuracy_chk
    CHECK (
      response_accuracy_m IS NULL
      OR response_accuracy_m >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_service_order_assignments_order
  ON service_order_assignments (
    service_order_id,
    assigned_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_service_order_assignments_tech
  ON service_order_assignments (
    tecnico_id,
    assigned_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_service_order_assignments_status
  ON service_order_assignments (
    status,
    assigned_at DESC
  );

-- Solo una invitación pendiente por orden.
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_order_assignments_pending
  ON service_order_assignments (service_order_id)
  WHERE status = 'pendiente';


CREATE TABLE IF NOT EXISTS service_order_current_custody (
  service_order_id UUID PRIMARY KEY,
  holder_user_id UUID NOT NULL,
  custody_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL,

  latitude NUMERIC(10, 7) NULL,
  longitude NUMERIC(10, 7) NULL,
  accuracy_m NUMERIC(10, 2) NULL,
  location_captured_at TIMESTAMPTZ NULL,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT service_order_current_custody_order_fk
    FOREIGN KEY (service_order_id)
    REFERENCES service_orders(id)
    ON DELETE CASCADE,

  CONSTRAINT service_order_current_custody_holder_fk
    FOREIGN KEY (holder_user_id)
    REFERENCES usuarios(id)
    ON DELETE RESTRICT,

  CONSTRAINT service_order_current_custody_updated_by_fk
    FOREIGN KEY (updated_by)
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  CONSTRAINT service_order_current_custody_lat_chk
    CHECK (
      latitude IS NULL
      OR latitude BETWEEN -90 AND 90
    ),

  CONSTRAINT service_order_current_custody_long_chk
    CHECK (
      longitude IS NULL
      OR longitude BETWEEN -180 AND 180
    ),

  CONSTRAINT service_order_current_custody_accuracy_chk
    CHECK (
      accuracy_m IS NULL
      OR accuracy_m >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_service_order_current_custody_holder
  ON service_order_current_custody (
    holder_user_id,
    custody_since DESC
  );


CREATE TABLE IF NOT EXISTS service_order_custody_events (
  id UUID PRIMARY KEY,
  service_order_id UUID NOT NULL,

  action VARCHAR(30) NOT NULL,

  from_user_id UUID NULL,
  to_user_id UUID NULL,
  performed_by UUID NULL,

  note TEXT NULL,

  latitude NUMERIC(10, 7) NULL,
  longitude NUMERIC(10, 7) NULL,
  accuracy_m NUMERIC(10, 2) NULL,
  location_captured_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT service_order_custody_events_order_fk
    FOREIGN KEY (service_order_id)
    REFERENCES service_orders(id)
    ON DELETE CASCADE,

  CONSTRAINT service_order_custody_events_from_fk
    FOREIGN KEY (from_user_id)
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  CONSTRAINT service_order_custody_events_to_fk
    FOREIGN KEY (to_user_id)
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  CONSTRAINT service_order_custody_events_performed_by_fk
    FOREIGN KEY (performed_by)
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  CONSTRAINT service_order_custody_events_action_chk
    CHECK (
      action IN (
        'tomada',
        'transferida',
        'liberada'
      )
    ),

  CONSTRAINT service_order_custody_events_lat_chk
    CHECK (
      latitude IS NULL
      OR latitude BETWEEN -90 AND 90
    ),

  CONSTRAINT service_order_custody_events_long_chk
    CHECK (
      longitude IS NULL
      OR longitude BETWEEN -180 AND 180
    ),

  CONSTRAINT service_order_custody_events_accuracy_chk
    CHECK (
      accuracy_m IS NULL
      OR accuracy_m >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_service_order_custody_events_order
  ON service_order_custody_events (
    service_order_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_service_order_custody_events_to_user
  ON service_order_custody_events (
    to_user_id,
    created_at DESC
  );

COMMIT;
