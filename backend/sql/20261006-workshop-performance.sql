BEGIN;
CREATE TABLE IF NOT EXISTS service_execution_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), service_order_id uuid NOT NULL REFERENCES service_orders(id),
 actor_user_id uuid REFERENCES usuarios(id), started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 CHECK(ended_at IS NULL OR ended_at>=started_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS service_execution_one_open ON service_execution_sessions(service_order_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS service_execution_order ON service_execution_sessions(service_order_id,started_at);
ALTER TABLE service_order_closures ADD COLUMN IF NOT EXISTS actual_minutes numeric(12,2);
ALTER TABLE service_order_closures ADD COLUMN IF NOT EXISTS estimated_minutes integer;
ALTER TABLE service_order_closures ADD COLUMN IF NOT EXISTS duration_note text;
CREATE TABLE IF NOT EXISTS workshop_catalog(product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('tool','supply')));
CREATE TABLE IF NOT EXISTS workshop_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES products(id),
 service_order_id uuid NOT NULL REFERENCES service_orders(id), technician_id uuid NOT NULL REFERENCES usuarios(id),
 quantity integer NOT NULL CHECK(quantity>0), returned_quantity integer NOT NULL DEFAULT 0 CHECK(returned_quantity>=0 AND returned_quantity<=quantity),
 note text, assigned_by uuid NOT NULL REFERENCES usuarios(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workshop_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id uuid NOT NULL REFERENCES workshop_assignments(id),
 action text NOT NULL CHECK(action IN ('assigned','returned')),quantity integer NOT NULL CHECK(quantity>0),actor_user_id uuid NOT NULL REFERENCES usuarios(id),note text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workshop_open ON workshop_assignments(technician_id,service_order_id) WHERE returned_quantity<quantity;
CREATE INDEX IF NOT EXISTS workshop_product ON workshop_assignments(product_id,created_at);
CREATE INDEX IF NOT EXISTS workshop_history ON workshop_events(assignment_id,created_at);
CREATE INDEX IF NOT EXISTS dashboard_service_dates ON service_orders("createdAt",tecnico_id);
CREATE INDEX IF NOT EXISTS client_active_name ON clients(activo,razon_social,documento);
CREATE INDEX IF NOT EXISTS mirror_active_name ON sync_clientes(activo,razon_social,documento);
CREATE INDEX IF NOT EXISTS dashboard_invoice_service ON invoices(service_order_id);
CREATE INDEX IF NOT EXISTS dashboard_team_actor ON service_order_team_members(technician_id,service_order_id);
COMMIT;
