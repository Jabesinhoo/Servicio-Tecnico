BEGIN;
CREATE TABLE IF NOT EXISTS service_order_equipment (
 id uuid PRIMARY KEY,service_order_id uuid NOT NULL REFERENCES service_orders(id),
 data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_equipment_by_order ON service_order_equipment(service_order_id);
ALTER TABLE service_order_reception_checklists ADD COLUMN IF NOT EXISTS equipment_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE service_intake_creation_files ADD COLUMN IF NOT EXISTS equipment_id uuid;
CREATE INDEX IF NOT EXISTS intake_photos_by_equipment ON service_intake_creation_files(intake_id,equipment_id,kind);
ALTER TABLE service_order_evidences ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES service_order_equipment(id);
COMMIT;
