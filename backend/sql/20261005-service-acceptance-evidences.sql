BEGIN;
CREATE TABLE IF NOT EXISTS service_intake_acceptance_evidences (
 id UUID PRIMARY KEY, intake_id UUID NOT NULL REFERENCES service_order_intakes(id) ON DELETE CASCADE,
 created_by UUID NOT NULL REFERENCES usuarios(id), original_name TEXT NOT NULL,
 mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 26214400),
 storage_name TEXT NOT NULL UNIQUE, upload_key UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(intake_id, upload_key)
);
COMMIT;
