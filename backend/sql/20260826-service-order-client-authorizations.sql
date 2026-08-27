BEGIN;

CREATE TABLE IF NOT EXISTS service_order_authorizations (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    diagnosis_id UUID NULL
        REFERENCES service_order_diagnostics(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    requested_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    request_type VARCHAR(40) NOT NULL,
    subject VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    estimated_amount NUMERIC(14,2) NULL
        CHECK (estimated_amount IS NULL OR estimated_amount >= 0),
    requested_components TEXT NULL,
    diagnosis_snapshot JSONB NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    client_name VARCHAR(180) NULL,
    client_document VARCHAR(80) NULL,
    decision_channel VARCHAR(40) NULL,
    decision_reference TEXT NULL,
    decision_note TEXT NULL,
    decided_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT service_order_authorizations_type_ck
        CHECK (request_type IN ('repair', 'materials', 'additional_work', 'other')),
    CONSTRAINT service_order_authorizations_status_ck
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_order_authorization_pending
    ON service_order_authorizations (service_order_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_service_order_authorizations_order_created
    ON service_order_authorizations (service_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_order_authorizations_status
    ON service_order_authorizations (status, created_at DESC);

CREATE TABLE IF NOT EXISTS service_order_authorization_evidences (
    id UUID PRIMARY KEY,
    authorization_id UUID NOT NULL
        REFERENCES service_order_authorizations(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    uploaded_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    original_name VARCHAR(255) NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_path TEXT NOT NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_authorization_evidences_auth
    ON service_order_authorization_evidences (authorization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS service_order_authorization_events (
    id UUID PRIMARY KEY,
    authorization_id UUID NOT NULL
        REFERENCES service_order_authorizations(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    actor_user_id UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_authorization_events_auth
    ON service_order_authorization_events (authorization_id, created_at ASC);

COMMIT;
