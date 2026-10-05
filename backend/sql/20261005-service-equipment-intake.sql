-- Ingreso de equipo en la solicitud. Ejecutar antes de actualizar el backend.
-- Conserva solicitudes y órdenes existentes; no confirma recepciones ni firmas.
BEGIN;
ALTER TABLE service_order_intakes
  ADD COLUMN IF NOT EXISTS equipment_intake JSONB NULL;
COMMIT;
