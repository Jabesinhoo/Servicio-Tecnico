BEGIN;

CREATE TABLE IF NOT EXISTS service_order_documents (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    document_type VARCHAR(40) NOT NULL,
    version INTEGER NOT NULL CHECK (version >= 1),
    status VARCHAR(20) NOT NULL DEFAULT 'generated',

    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    sha256 VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,

    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

    generated_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_documents_type_ck
        CHECK (
            document_type IN (
                'reception_act',
                'technical_closure',
                'final_delivery'
            )
        ),

    CONSTRAINT service_order_documents_status_ck
        CHECK (
            status IN (
                'generated',
                'superseded'
            )
        ),

    CONSTRAINT service_order_documents_order_type_version_uk
        UNIQUE (
            service_order_id,
            document_type,
            version
        )
);

CREATE INDEX IF NOT EXISTS idx_service_order_documents_order
    ON service_order_documents (
        service_order_id,
        document_type,
        version DESC
    );

CREATE INDEX IF NOT EXISTS idx_service_order_documents_generated
    ON service_order_documents (
        generated_at DESC
    );


CREATE TABLE IF NOT EXISTS service_order_document_events (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    document_id UUID NULL
        REFERENCES service_order_documents(id)
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

CREATE INDEX IF NOT EXISTS idx_service_order_document_events_order
    ON service_order_document_events (
        service_order_id,
        created_at ASC
    );

COMMIT;
