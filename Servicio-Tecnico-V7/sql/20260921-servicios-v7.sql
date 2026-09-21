BEGIN;

CREATE TABLE IF NOT EXISTS service_order_schedule_blocks (
  id uuid PRIMARY KEY,
  service_order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  block_role varchar(20) NOT NULL DEFAULT 'primary',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  source varchar(20) NOT NULL DEFAULT 'automatic',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT service_order_schedule_blocks_time_ck
    CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_sosb_technician_active
  ON service_order_schedule_blocks (technician_id, start_at, end_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sosb_order_active
  ON service_order_schedule_blocks (service_order_id, start_at)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION prevent_service_technician_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM service_order_schedule_blocks b
    WHERE b.technician_id = NEW.technician_id
      AND b.status = 'active'
      AND b.id <> NEW.id
      AND b.start_at < NEW.end_at
      AND b.end_at > NEW.start_at
  ) THEN
    RAISE EXCEPTION 'TECHNICIAN_SCHEDULE_CONFLICT'
      USING ERRCODE = '23P01',
            DETAIL = 'El técnico ya tiene un bloque activo que se solapa con el intervalo solicitado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_technician_overlap
  ON service_order_schedule_blocks;

CREATE TRIGGER trg_service_technician_overlap
BEFORE INSERT OR UPDATE OF technician_id, start_at, end_at, status
ON service_order_schedule_blocks
FOR EACH ROW
EXECUTE FUNCTION prevent_service_technician_overlap();

CREATE INDEX IF NOT EXISTS idx_servicio_materiales_os_estado
  ON servicio_materiales (service_order_id, estado);

COMMIT;
