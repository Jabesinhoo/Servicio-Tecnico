BEGIN;
ALTER TABLE sync_clientes ADD COLUMN IF NOT EXISTS client_profile JSONB,
 ADD COLUMN IF NOT EXISTS profile_relations JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS profile_schema JSONB;
CREATE INDEX IF NOT EXISTS idx_sync_clientes_documento_profile ON sync_clientes(documento);
ALTER TABLE service_order_intakes ADD COLUMN IF NOT EXISTS client_snapshot JSONB,
 ADD COLUMN IF NOT EXISTS service_site JSONB;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS service_site JSONB;
COMMIT;
