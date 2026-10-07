BEGIN;
ALTER TABLE service_order_intakes ADD COLUMN IF NOT EXISTS acceptance_signature_required boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS service_intake_creation_files(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),intake_id uuid NOT NULL REFERENCES service_order_intakes(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('reception_photo','invoice_support')),upload_key uuid NOT NULL,name text NOT NULL,mime text NOT NULL,
 content bytea NOT NULL CHECK(octet_length(content)>0 AND octet_length(content)<=8388608),created_by uuid NOT NULL REFERENCES usuarios(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(intake_id,upload_key)
);
CREATE INDEX IF NOT EXISTS intake_files_by_intake ON service_intake_creation_files(intake_id,kind);
CREATE TABLE IF NOT EXISTS service_intake_acceptances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),intake_id uuid NOT NULL REFERENCES service_order_intakes(id),client_id uuid NOT NULL REFERENCES clients(id),
 signer_name text NOT NULL,signer_document text NOT NULL,snapshot jsonb NOT NULL,snapshot_hash text NOT NULL,signature bytea NOT NULL,pdf bytea NOT NULL,
 captured_by uuid NOT NULL REFERENCES usuarios(id),captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intake_acceptance_versions ON service_intake_acceptances(intake_id,captured_at DESC);
CREATE INDEX IF NOT EXISTS intake_acceptance_client ON service_intake_acceptances(client_id,captured_at DESC);
CREATE INDEX IF NOT EXISTS sync_client_external_lookup ON sync_clientes(id_externo);
CREATE INDEX IF NOT EXISTS sync_client_document_lookup ON sync_clientes(documento);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_descripcion text;
ALTER TABLE service_order_visit_events DROP CONSTRAINT IF EXISTS service_order_visit_event_type_chk;
ALTER TABLE service_order_visit_events ADD CONSTRAINT service_order_visit_event_type_chk CHECK(event_type IN ('en_camino','llegada_validada','llegada_declarada'));
CREATE TABLE IF NOT EXISTS service_intake_worldoffice_invoices(
 intake_id uuid PRIMARY KEY REFERENCES service_order_intakes(id),mapping_id uuid NOT NULL,invoice_reference text NOT NULL,record jsonb NOT NULL,linked_by uuid NOT NULL REFERENCES usuarios(id),linked_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
