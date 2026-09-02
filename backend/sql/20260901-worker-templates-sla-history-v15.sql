BEGIN;

CREATE TABLE IF NOT EXISTS service_notification_templates (
    id UUID PRIMARY KEY,
    template_key VARCHAR(120) NOT NULL UNIQUE,
    event_type VARCHAR(60) NOT NULL,
    channel VARCHAR(30) NOT NULL,
    name VARCHAR(180) NOT NULL,
    subject_template TEXT NULL,
    body_template TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    updated_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_notification_templates_channel_ck
        CHECK (
            channel IN (
                'whatsapp',
                'email',
                'sms',
                'webhook'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_service_notification_templates_event
    ON service_notification_templates (
        event_type,
        active,
        channel
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
VALUES
(
    '20000000-0000-4000-8000-000000000001',
    'ready_for_pickup_whatsapp',
    'ready_for_pickup',
    'whatsapp',
    'Servicio listo - WhatsApp',
    NULL,
    'Hola {{client_name}}, tu orden de servicio {{codigo_os}} ya fue validada por Direccion Tecnica y esta lista para entrega. Gracias.',
    FALSE,
    1,
    NOW(),
    NOW()
),
(
    '20000000-0000-4000-8000-000000000002',
    'ready_for_pickup_email',
    'ready_for_pickup',
    'email',
    'Servicio listo - Email',
    'Orden {{codigo_os}} lista para entrega',
    'Hola {{client_name}}. La orden de servicio {{codigo_os}} ya fue validada por Direccion Tecnica y esta lista para entrega.',
    FALSE,
    1,
    NOW(),
    NOW()
),
(
    '20000000-0000-4000-8000-000000000003',
    'delivery_completed_whatsapp',
    'delivery_completed',
    'whatsapp',
    'Entrega completada - WhatsApp',
    NULL,
    'Confirmamos la entrega de la orden {{codigo_os}} a {{receiver_name}}. Gracias por confiar en nuestro servicio tecnico.',
    FALSE,
    1,
    NOW(),
    NOW()
),
(
    '20000000-0000-4000-8000-000000000004',
    'delivery_completed_email',
    'delivery_completed',
    'email',
    'Entrega completada - Email',
    'Entrega confirmada - {{codigo_os}}',
    'Confirmamos la entrega final de la orden {{codigo_os}} a {{receiver_name}}.',
    FALSE,
    1,
    NOW(),
    NOW()
),
(
    '20000000-0000-4000-8000-000000000005',
    'sla_warning_webhook',
    'sla_warning',
    'webhook',
    'Alerta preventiva SLA',
    NULL,
    'La orden {{codigo_os}} esta proxima a vencer su SLA. Prioridad: {{priority}}. Objetivo: {{target_hours}} horas.',
    FALSE,
    1,
    NOW(),
    NOW()
),
(
    '20000000-0000-4000-8000-000000000006',
    'sla_breached_webhook',
    'sla_breached',
    'webhook',
    'SLA vencido',
    NULL,
    'La orden {{codigo_os}} supero su SLA. Prioridad: {{priority}}. Objetivo: {{target_hours}} horas.',
    FALSE,
    1,
    NOW(),
    NOW()
)
ON CONFLICT (template_key) DO NOTHING;


CREATE TABLE IF NOT EXISTS service_sla_alert_events (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    policy_id UUID NOT NULL
        REFERENCES service_sla_policies(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    alert_key VARCHAR(220) NOT NULL UNIQUE,
    alert_type VARCHAR(30) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    elapsed_hours NUMERIC(14,4) NOT NULL,
    target_hours INTEGER NOT NULL,
    warning_percent INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_sla_alert_events_type_ck
        CHECK (
            alert_type IN (
                'warning',
                'breached'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_service_sla_alert_events_order
    ON service_sla_alert_events (
        service_order_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_service_sla_alert_events_created
    ON service_sla_alert_events (
        created_at DESC,
        alert_type
    );


CREATE TABLE IF NOT EXISTS service_worker_heartbeats (
    worker_name VARCHAR(100) PRIMARY KEY,
    host_name VARCHAR(180) NULL,
    process_id INTEGER NULL,
    started_at TIMESTAMPTZ NULL,
    heartbeat_at TIMESTAMPTZ NULL,
    last_run_at TIMESTAMPTZ NULL,
    last_status VARCHAR(30) NULL,
    last_result JSONB NULL,
    last_error TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
