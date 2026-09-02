BEGIN;

CREATE TABLE IF NOT EXISTS service_order_financial_controls (
    service_order_id UUID PRIMARY KEY
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    intake_id UUID NULL
        REFERENCES service_order_intakes(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    billing_mode VARCHAR(20) NOT NULL DEFAULT 'unclassified',
    verification_required BOOLEAN NOT NULL DEFAULT TRUE,

    clearance_status VARCHAR(20) NOT NULL DEFAULT 'pending',

    invoice_reference VARCHAR(180) NULL,
    payment_reference VARCHAR(220) NULL,

    external_system VARCHAR(40) NULL,
    external_client_id VARCHAR(120) NULL,
    external_invoice_id VARCHAR(180) NULL,

    expected_amount NUMERIC(14,2) NULL
        CHECK (
            expected_amount IS NULL
            OR expected_amount >= 0
        ),

    last_verified_at TIMESTAMPTZ NULL,
    last_verified_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    note TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_financial_controls_billing_ck
        CHECK (
            billing_mode IN (
                'unclassified',
                'prepaid',
                'postpaid'
            )
        ),

    CONSTRAINT service_order_financial_controls_status_ck
        CHECK (
            clearance_status IN (
                'pending',
                'cleared',
                'blocked',
                'not_required'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_service_order_financial_controls_status
    ON service_order_financial_controls (
        clearance_status,
        updated_at DESC
    );


CREATE TABLE IF NOT EXISTS service_order_financial_verifications (
    id UUID PRIMARY KEY,

    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    verification_source VARCHAR(40) NOT NULL,
    verification_kind VARCHAR(40) NOT NULL,
    result_status VARCHAR(20) NOT NULL,

    invoice_reference VARCHAR(180) NULL,
    payment_reference VARCHAR(220) NULL,
    external_reference VARCHAR(220) NULL,

    balance_amount NUMERIC(14,2) NULL,
    paid_amount NUMERIC(14,2) NULL,

    evidence_note TEXT NULL,
    source_snapshot JSONB NULL,

    verified_by UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_financial_verifications_source_ck
        CHECK (
            verification_source IN (
                'intake',
                'manual',
                'worldoffice_mirror',
                'other'
            )
        ),

    CONSTRAINT service_order_financial_verifications_kind_ck
        CHECK (
            verification_kind IN (
                'payment_confirmed',
                'credit_authorized',
                'balance_zero',
                'manual_review',
                'not_required',
                'blocked'
            )
        ),

    CONSTRAINT service_order_financial_verifications_status_ck
        CHECK (
            result_status IN (
                'pending',
                'cleared',
                'blocked',
                'not_required'
            )
        ),

    CONSTRAINT service_order_financial_verifications_balance_ck
        CHECK (
            balance_amount IS NULL
            OR balance_amount >= 0
        ),

    CONSTRAINT service_order_financial_verifications_paid_ck
        CHECK (
            paid_amount IS NULL
            OR paid_amount >= 0
        )
);

CREATE INDEX IF NOT EXISTS idx_service_order_financial_verifications_order
    ON service_order_financial_verifications (
        service_order_id,
        verified_at DESC
    );


CREATE TABLE IF NOT EXISTS service_order_financial_events (
    id UUID PRIMARY KEY,

    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    event_type VARCHAR(60) NOT NULL,

    actor_user_id UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    metadata JSONB NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_financial_events_order
    ON service_order_financial_events (
        service_order_id,
        created_at ASC
    );


INSERT INTO service_order_financial_controls (
    service_order_id,
    intake_id,
    billing_mode,
    verification_required,
    clearance_status,
    invoice_reference,
    payment_reference,
    expected_amount,
    last_verified_at,
    last_verified_by,
    note,
    created_at,
    updated_at
)
SELECT
    i.service_order_id,
    i.id,
    i.billing_mode,
    TRUE,
    CASE
        WHEN i.billing_mode = 'prepaid'
             AND i.payment_status = 'verified'
        THEN 'cleared'
        WHEN i.payment_status = 'not_required'
        THEN 'not_required'
        ELSE 'pending'
    END,
    i.invoice_reference,
    i.payment_reference,
    i.base_value,
    i.payment_verified_at,
    i.payment_verified_by,
    CASE
        WHEN i.billing_mode = 'prepaid'
             AND i.payment_status = 'verified'
        THEN 'Inicializado desde verificación de pago del intake.'
        WHEN i.billing_mode = 'postpaid'
        THEN 'Modalidad postpago: requiere control financiero antes de la entrega final.'
        ELSE 'Control financiero inicializado desde intake.'
    END,
    NOW(),
    NOW()
FROM service_order_intakes i
WHERE i.service_order_id IS NOT NULL
ON CONFLICT (service_order_id) DO NOTHING;


INSERT INTO service_order_financial_controls (
    service_order_id,
    intake_id,
    billing_mode,
    verification_required,
    clearance_status,
    note,
    created_at,
    updated_at
)
SELECT
    so.id,
    NULL,
    'unclassified',
    TRUE,
    'pending',
    'Orden activa histórica sin intake correlacionado. Modalidad financiera por definir.',
    NOW(),
    NOW()
FROM service_orders so
WHERE so.estado::text NOT IN (
        'cerrada',
        'cancelado',
        'rechazado'
    )
  AND NOT EXISTS (
      SELECT 1
      FROM service_order_financial_controls fc
      WHERE fc.service_order_id = so.id
  )
ON CONFLICT (service_order_id) DO NOTHING;


INSERT INTO service_order_financial_verifications (
    id,
    service_order_id,
    verification_source,
    verification_kind,
    result_status,
    invoice_reference,
    payment_reference,
    balance_amount,
    paid_amount,
    evidence_note,
    source_snapshot,
    verified_by,
    verified_at,
    created_at
)
SELECT
    md5(
        i.service_order_id::text ||
        ':intake-payment'
    )::uuid,
    i.service_order_id,
    'intake',
    'payment_confirmed',
    'cleared',
    i.invoice_reference,
    i.payment_reference,
    0,
    i.base_value,
    'Verificación heredada del intake.',
    jsonb_build_object(
        'intake_id', i.id,
        'billing_mode', i.billing_mode,
        'payment_status', i.payment_status,
        'payment_method', i.payment_method,
        'payment_reference', i.payment_reference,
        'invoice_reference', i.invoice_reference
    ),
    i.payment_verified_by,
    COALESCE(
        i.payment_verified_at,
        NOW()
    ),
    NOW()
FROM service_order_intakes i
WHERE i.service_order_id IS NOT NULL
  AND i.billing_mode = 'prepaid'
  AND i.payment_status = 'verified'
  AND i.payment_verified_by IS NOT NULL
ON CONFLICT (id) DO NOTHING;


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
    '30000000-0000-4000-8000-000000000001',
    'formal_document_generated_webhook',
    'formal_document_generated',
    'webhook',
    'Documento formal generado',
    NULL,
    'Documento {{document_type}} v{{version}} generado para {{codigo_os}}. SHA-256: {{sha256}}.',
    FALSE,
    1,
    NOW(),
    NOW()
)
ON CONFLICT (template_key) DO NOTHING;

COMMIT;
