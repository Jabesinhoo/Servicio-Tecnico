BEGIN;
-- Recognized product descriptions seed workshop classification; explicit catalog choices win.
CREATE OR REPLACE FUNCTION workshop_kind_from_text(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE lower(btrim(value)) WHEN 'herramienta' THEN 'tool' WHEN 'herramientas' THEN 'tool' WHEN 'tool' THEN 'tool' WHEN 'insumo' THEN 'supply' WHEN 'insumos' THEN 'supply' WHEN 'consumible' THEN 'supply' WHEN 'supply' THEN 'supply' ELSE NULL END;
$$;
INSERT INTO workshop_catalog(product_id,kind)
SELECT id,COALESCE(workshop_kind_from_text(tipo_descripcion),workshop_kind_from_text(tipo::text)) FROM products
WHERE COALESCE(workshop_kind_from_text(tipo_descripcion),workshop_kind_from_text(tipo::text)) IS NOT NULL
ON CONFLICT(product_id) DO NOTHING;
CREATE OR REPLACE FUNCTION seed_product_workshop_kind() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind_value text; BEGIN
 kind_value:=COALESCE(workshop_kind_from_text(NEW.tipo_descripcion),workshop_kind_from_text(NEW.tipo::text));
 IF kind_value IS NOT NULL THEN INSERT INTO workshop_catalog(product_id,kind) VALUES(NEW.id,kind_value) ON CONFLICT(product_id) DO NOTHING; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS seed_workshop_kind ON products;
CREATE TRIGGER seed_workshop_kind AFTER INSERT OR UPDATE OF tipo,tipo_descripcion ON products FOR EACH ROW EXECUTE FUNCTION seed_product_workshop_kind();
ALTER TABLE servicio_materiales ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS external_name text;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS external_description text;
ALTER TABLE servicio_materiales ADD COLUMN IF NOT EXISTS external_unit text;
ALTER TABLE servicio_materiales DROP CONSTRAINT IF EXISTS material_product_or_external_ck;
ALTER TABLE servicio_materiales ADD CONSTRAINT material_product_or_external_ck CHECK ((product_id IS NOT NULL AND external_name IS NULL) OR (product_id IS NULL AND external_name IS NOT NULL AND length(btrim(external_name))>0));
-- Material events carry actor and a readable request summary into history and notifications.
DROP TRIGGER IF EXISTS service_material_activity ON service_order_events;
CREATE TRIGGER service_material_activity AFTER INSERT ON service_order_events FOR EACH ROW
 WHEN (NEW.event_type IN ('material_requested','material_approved','material_rejected','material_delivered','material_consumed','material_returned'))
 EXECUTE FUNCTION record_service_activity('Material del servicio');
COMMIT;
