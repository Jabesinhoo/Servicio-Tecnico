BEGIN;

CREATE TABLE IF NOT EXISTS service_order_intakes (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL
        REFERENCES clients(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    created_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    source_type VARCHAR(30) NOT NULL DEFAULT 'customer',
    source_reference VARCHAR(180) NULL,

    request_description TEXT NOT NULL,
    classification VARCHAR(30) NULL,

    service_type_id VARCHAR(120) NULL,
    service_type_name VARCHAR(180) NULL,
    service_type_category VARCHAR(120) NULL,
    base_value NUMERIC(14,2) NULL
        CHECK (base_value IS NULL OR base_value >= 0),
    estimated_minutes INTEGER NULL
        CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),

    scope_text TEXT NULL,
    conditions_text TEXT NULL,
    additional_costs_notice TEXT NULL,

    client_acceptance BOOLEAN NOT NULL DEFAULT FALSE,
    client_acceptance_name VARCHAR(180) NULL,
    client_acceptance_document VARCHAR(80) NULL,
    client_acceptance_channel VARCHAR(40) NULL,
    client_acceptance_reference TEXT NULL,
    client_accepted_at TIMESTAMPTZ NULL,

    billing_mode VARCHAR(20) NOT NULL DEFAULT 'prepaid',
    invoice_reference VARCHAR(180) NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(60) NULL,
    payment_reference VARCHAR(220) NULL,
    payment_verified_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    payment_verified_at TIMESTAMPTZ NULL,
    postpaid_reason TEXT NULL,

    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    scheduled_date DATE NULL,
    scheduled_time TIME NULL,
    estimated_duration INTEGER NULL
        CHECK (estimated_duration IS NULL OR estimated_duration > 0),

    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    service_order_id UUID NULL UNIQUE
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    cancelled_reason TEXT NULL,
    cancelled_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_intakes_source_ck
        CHECK (source_type IN ('customer','technician','sale','other')),
    CONSTRAINT service_order_intakes_class_ck
        CHECK (classification IS NULL OR classification IN ('diagnostic','specific')),
    CONSTRAINT service_order_intakes_billing_ck
        CHECK (billing_mode IN ('prepaid','postpaid')),
    CONSTRAINT service_order_intakes_payment_ck
        CHECK (payment_status IN ('pending','verified','not_required')),
    CONSTRAINT service_order_intakes_status_ck
        CHECK (status IN ('draft','ready','activated','cancelled')),
    CONSTRAINT service_order_intakes_priority_ck
        CHECK (priority IN ('baja','normal','alta','urgente'))
);

CREATE INDEX IF NOT EXISTS idx_service_order_intakes_status_created
    ON service_order_intakes (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_order_intakes_client_created
    ON service_order_intakes (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_order_intakes_created_by
    ON service_order_intakes (created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS service_order_number_counters (
    year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL CHECK (last_number >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_order_events (
    id UUID PRIMARY KEY,
    service_order_id UUID NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    intake_id UUID NULL
        REFERENCES service_order_intakes(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    event_type VARCHAR(60) NOT NULL,
    actor_user_id UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_events_order_created
    ON service_order_events (service_order_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_service_order_events_intake_created
    ON service_order_events (intake_id, created_at ASC);

COMMIT;
