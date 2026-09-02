BEGIN;

CREATE TABLE IF NOT EXISTS service_order_closures (
    service_order_id UUID PRIMARY KEY
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
    final_result TEXT NULL,
    final_notes TEXT NULL,
    last_checklist_saved_at TIMESTAMPTZ NULL,

    technical_closed_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    technical_closed_at TIMESTAMPTZ NULL,

    handed_to_direction_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    handed_to_direction_at TIMESTAMPTZ NULL,

    direction_received_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    direction_received_at TIMESTAMPTZ NULL,

    direction_validated_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    direction_validated_at TIMESTAMPTZ NULL,
    direction_validation_note TEXT NULL,

    rework_reason TEXT NULL,
    rework_started_at TIMESTAMPTZ NULL,
    rework_count INTEGER NOT NULL DEFAULT 0
        CHECK (rework_count >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_closures_status_ck
        CHECK (
            status IN (
                'draft',
                'technical_closed',
                'handed_to_direction',
                'direction_received',
                'validated',
                'rework_required'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_service_order_closures_status
    ON service_order_closures (
        status,
        updated_at DESC
    );


CREATE TABLE IF NOT EXISTS service_order_final_evidences (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    uploaded_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    original_name VARCHAR(255) NULL,
    mime_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL
        CHECK (size_bytes > 0),
    storage_path TEXT NOT NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_final_evidences_order
    ON service_order_final_evidences (
        service_order_id,
        created_at DESC
    );


CREATE TABLE IF NOT EXISTS service_order_closure_events (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    actor_user_id UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_closure_events_order
    ON service_order_closure_events (
        service_order_id,
        created_at ASC
    );

COMMIT;
