BEGIN;
CREATE TABLE IF NOT EXISTS service_type_inventory_requirements (
 service_type_id uuid NOT NULL REFERENCES tipos_servicio(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES products(id),
 quantity integer NOT NULL CHECK(quantity > 0 AND quantity <= 100000),
 PRIMARY KEY(service_type_id, product_id)
);
ALTER TABLE service_order_services ADD COLUMN IF NOT EXISTS inventory_requirements jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMIT;
