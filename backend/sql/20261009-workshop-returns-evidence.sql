BEGIN;
ALTER TABLE workshop_events ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS workshop_return_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id uuid NOT NULL REFERENCES workshop_assignments(id),
 uploaded_by uuid NOT NULL REFERENCES usuarios(id),storage_path text NOT NULL,mime_type text NOT NULL,
 original_name text NOT NULL,size_bytes integer NOT NULL CHECK(size_bytes>0),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workshop_return_photos_assignment ON workshop_return_photos(assignment_id,created_at);
COMMIT;
