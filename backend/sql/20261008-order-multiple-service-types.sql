BEGIN;
ALTER TABLE service_order_intakes ADD COLUMN IF NOT EXISTS service_types jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE service_order_services ADD COLUMN IF NOT EXISTS estimated_minutes integer CHECK(estimated_minutes>0);
COMMIT;
