BEGIN;

ALTER TABLE service_order_financial_verifications
    DROP CONSTRAINT IF EXISTS service_order_financial_verifications_source_ck;

ALTER TABLE service_order_financial_verifications
    ADD CONSTRAINT service_order_financial_verifications_source_ck
    CHECK (
        verification_source IN (
            'intake',
            'manual',
            'worldoffice_mirror',
            'worldoffice_live',
            'other'
        )
    );


CREATE TABLE IF NOT EXISTS worldoffice_financial_discovery_runs (
    id UUID PRIMARY KEY,

    status VARCHAR(20) NOT NULL DEFAULT 'completed',

    database_name VARCHAR(180) NULL,

    object_count INTEGER NOT NULL DEFAULT 0
        CHECK (object_count >= 0),

    candidate_count INTEGER NOT NULL DEFAULT 0
        CHECK (candidate_count >= 0),

    candidate_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,

    started_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT worldoffice_financial_discovery_runs_status_ck
        CHECK (
            status IN (
                'completed',
                'failed'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_worldoffice_financial_discovery_runs_created
    ON worldoffice_financial_discovery_runs (
        completed_at DESC
    );


CREATE TABLE IF NOT EXISTS worldoffice_financial_mappings (
    id UUID PRIMARY KEY,

    profile_name VARCHAR(120) NOT NULL,

    source_schema VARCHAR(128) NOT NULL,
    source_object VARCHAR(128) NOT NULL,
    source_object_type VARCHAR(20) NOT NULL DEFAULT 'TABLE',

    invoice_reference_column VARCHAR(128) NOT NULL,

    client_document_column VARCHAR(128) NULL,
    client_external_id_column VARCHAR(128) NULL,

    total_amount_column VARCHAR(128) NULL,
    paid_amount_column VARCHAR(128) NULL,
    balance_amount_column VARCHAR(128) NULL,

    status_column VARCHAR(128) NULL,
    due_date_column VARCHAR(128) NULL,
    currency_column VARCHAR(128) NULL,

    balance_tolerance NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (balance_tolerance >= 0),

    active BOOLEAN NOT NULL DEFAULT FALSE,
    observation_only BOOLEAN NOT NULL DEFAULT TRUE,

    note TEXT NULL,

    created_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    updated_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT worldoffice_financial_mappings_type_ck
        CHECK (
            source_object_type IN (
                'TABLE',
                'VIEW'
            )
        ),

    CONSTRAINT worldoffice_financial_mappings_amount_columns_ck
        CHECK (
            balance_amount_column IS NOT NULL
            OR (
                total_amount_column IS NOT NULL
                AND
                paid_amount_column IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_worldoffice_financial_mappings_profile
    ON worldoffice_financial_mappings (
        LOWER(profile_name)
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_worldoffice_financial_mappings_one_active
    ON worldoffice_financial_mappings (
        active
    )
    WHERE active = TRUE;


CREATE TABLE IF NOT EXISTS worldoffice_financial_read_events (
    id UUID PRIMARY KEY,

    service_order_id UUID NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    mapping_id UUID NULL
        REFERENCES worldoffice_financial_mappings(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    event_type VARCHAR(50) NOT NULL,

    invoice_reference VARCHAR(180) NULL,

    matched_rows INTEGER NOT NULL DEFAULT 0
        CHECK (matched_rows >= 0),

    result_status VARCHAR(30) NOT NULL DEFAULT 'unknown',

    normalized_result JSONB NULL,

    performed_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT worldoffice_financial_read_events_type_ck
        CHECK (
            event_type IN (
                'live_check',
                'balance_zero_registered',
                'preview',
                'discovery'
            )
        ),

    CONSTRAINT worldoffice_financial_read_events_status_ck
        CHECK (
            result_status IN (
                'unknown',
                'not_found',
                'ambiguous',
                'client_mismatch',
                'pending',
                'eligible_zero_balance',
                'registered'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_worldoffice_financial_read_events_order
    ON worldoffice_financial_read_events (
        service_order_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_worldoffice_financial_read_events_mapping
    ON worldoffice_financial_read_events (
        mapping_id,
        created_at DESC
    );


INSERT INTO service_notification_templates (
    id,
    template_key,
    event_type,
    channel,
    name,
    subject_template,
    body_template,
    active,
    version,
    created_at,
    updated_at
)
VALUES (
    '30000000-0000-4000-8000-000000000002',
    'worldoffice_balance_verified_webhook',
    'worldoffice_balance_verified',
    'webhook',
    'Saldo WorldOffice verificado',
    NULL,
    'Saldo cero verificado en WorldOffice para {{codigo_os}} / factura {{invoice_reference}}.',
    FALSE,
    1,
    NOW(),
    NOW()
)
ON CONFLICT (template_key) DO NOTHING;

COMMIT;
