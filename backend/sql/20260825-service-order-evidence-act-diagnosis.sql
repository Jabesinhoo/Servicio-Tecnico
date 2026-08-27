BEGIN;

CREATE TABLE IF NOT EXISTS service_order_evidences (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL REFERENCES service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
    technician_id UUID NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
    stage VARCHAR(40) NOT NULL,
    category VARCHAR(80) NULL,
    original_name VARCHAR(255) NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_path TEXT NOT NULL,
    note TEXT NULL,
    captured_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_service_order_evidences_order_stage
    ON service_order_evidences (service_order_id, stage, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_order_evidences_technician
    ON service_order_evidences (technician_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS service_order_reception_acts (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL UNIQUE REFERENCES service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    checklist_id UUID NULL REFERENCES service_order_reception_checklists(id) ON UPDATE CASCADE ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'signed',
    signed_by_name VARCHAR(180) NOT NULL,
    signed_by_document VARCHAR(80) NULL,
    signature_mime_type VARCHAR(80) NOT NULL DEFAULT 'image/png',
    signature_storage_path TEXT NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    latitude NUMERIC(10,7) NULL,
    longitude NUMERIC(10,7) NULL,
    accuracy_m NUMERIC(10,2) NULL,
    location_captured_at TIMESTAMPTZ NULL,
    location_integrity_status VARCHAR(30) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_reception_acts_signed_at
    ON service_order_reception_acts (signed_at DESC);

CREATE TABLE IF NOT EXISTS service_order_diagnostics (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL UNIQUE REFERENCES service_orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    work_type VARCHAR(40) NOT NULL DEFAULT 'diagnostico',
    result_status VARCHAR(30) NULL,
    description TEXT NULL,
    solution_available BOOLEAN NULL,
    approximate_cost NUMERIC(14,2) NULL CHECK (approximate_cost IS NULL OR approximate_cost >= 0),
    required_components TEXT NULL,
    functional_result TEXT NULL,
    activities_performed TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_service_order_diagnostics_status
    ON service_order_diagnostics (status, confirmed_at DESC);

COMMIT;
