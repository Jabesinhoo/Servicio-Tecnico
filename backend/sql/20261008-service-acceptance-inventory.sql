BEGIN;
ALTER TABLE workshop_assignments ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'tool' CHECK(item_kind IN ('tool','supply'));
ALTER TABLE workshop_assignments ADD COLUMN IF NOT EXISTS consumed_quantity integer NOT NULL DEFAULT 0 CHECK(consumed_quantity>=0);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='workshop_assignments'::regclass AND conname='workshop_assignment_balance_ck') THEN ALTER TABLE workshop_assignments ADD CONSTRAINT workshop_assignment_balance_ck CHECK(returned_quantity+consumed_quantity<=quantity); END IF; END $$;
ALTER TABLE workshop_events DROP CONSTRAINT IF EXISTS workshop_events_action_check;
ALTER TABLE workshop_events ADD CONSTRAINT workshop_events_action_check CHECK(action IN ('assigned','returned','consumed'));
CREATE TABLE IF NOT EXISTS service_inventory_allocations (
 service_order_id uuid PRIMARY KEY REFERENCES service_orders(id),
 technician_id uuid NOT NULL REFERENCES usuarios(id),created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
