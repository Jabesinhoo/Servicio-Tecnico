BEGIN;

CREATE TABLE IF NOT EXISTS service_sla_policies (
    id UUID PRIMARY KEY,
    priority VARCHAR(20) NOT NULL UNIQUE,
    target_hours INTEGER NULL
        CHECK (
            target_hours IS NULL
            OR target_hours > 0
        ),
    warning_percent INTEGER NOT NULL DEFAULT 80
        CHECK (
            warning_percent BETWEEN 50 AND 100
        ),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_sla_policies_priority_ck
        CHECK (
            priority IN (
                'baja',
                'normal',
                'alta',
                'urgente'
            )
        )
);

INSERT INTO service_sla_policies (
    id,
    priority,
    target_hours,
    warning_percent,
    active,
    created_at,
    updated_at
)
VALUES
    ('10000000-0000-4000-8000-000000000001','baja',NULL,80,FALSE,NOW(),NOW()),
    ('10000000-0000-4000-8000-000000000002','normal',NULL,80,FALSE,NOW(),NOW()),
    ('10000000-0000-4000-8000-000000000003','alta',NULL,80,FALSE,NOW(),NOW()),
    ('10000000-0000-4000-8000-000000000004','urgente',NULL,80,FALSE,NOW(),NOW())
ON CONFLICT (priority) DO NOTHING;


CREATE TABLE IF NOT EXISTS service_notification_outbox (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    event_type VARCHAR(60) NOT NULL,
    idempotency_key VARCHAR(180) NOT NULL UNIQUE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),
    last_error TEXT NULL,
    last_attempt_at TIMESTAMPTZ NULL,
    next_attempt_at TIMESTAMPTZ NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_notification_outbox_status_ck
        CHECK (
            status IN (
                'pending',
                'processing',
                'sent',
                'failed'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_service_notification_outbox_pending
    ON service_notification_outbox (
        status,
        next_attempt_at,
        created_at
    );

CREATE INDEX IF NOT EXISTS idx_service_notification_outbox_order
    ON service_notification_outbox (
        service_order_id,
        created_at DESC
    );

COMMIT;
