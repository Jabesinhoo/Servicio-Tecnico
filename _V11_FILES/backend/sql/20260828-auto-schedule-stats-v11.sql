BEGIN;

CREATE TABLE IF NOT EXISTS service_order_schedule_blocks (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    technician_id UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    block_role VARCHAR(20) NOT NULL DEFAULT 'support',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    source VARCHAR(30) NOT NULL DEFAULT 'auto',
    created_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_schedule_blocks_role_ck
        CHECK (block_role IN ('primary', 'support')),
    CONSTRAINT service_order_schedule_blocks_status_ck
        CHECK (status IN ('active', 'completed', 'cancelled')),
    CONSTRAINT service_order_schedule_blocks_source_ck
        CHECK (source IN ('auto', 'manual', 'legacy')),
    CONSTRAINT service_order_schedule_blocks_time_ck
        CHECK (end_at > start_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_schedule_active_order_tech
    ON service_order_schedule_blocks (
        service_order_id,
        technician_id
    )
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_service_schedule_tech_time
    ON service_order_schedule_blocks (
        technician_id,
        start_at,
        end_at
    )
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_service_schedule_order
    ON service_order_schedule_blocks (
        service_order_id,
        status
    );

-- Backfill: órdenes ya agendadas + miembros de equipo V10.
INSERT INTO service_order_schedule_blocks (
    id,
    service_order_id,
    technician_id,
    block_role,
    start_at,
    end_at,
    status,
    source,
    created_at,
    updated_at
)
SELECT
    md5(
        so.id::text || ':' ||
        tm.technician_id::text || ':v11'
    )::uuid,
    so.id,
    tm.technician_id,
    tm.member_role,
    (
        (
            so.fecha_agendada::date +
            COALESCE(
                so.hora_inicio_agendada,
                '08:00:00'::time
            )
        ) AT TIME ZONE 'America/Bogota'
    ),
    (
        (
            so.fecha_agendada::date +
            COALESCE(
                so.hora_inicio_agendada,
                '08:00:00'::time
            )
        ) AT TIME ZONE 'America/Bogota'
    ) +
        make_interval(
            mins => COALESCE(
                so.duracion_estimada,
                60
            )
        ),
    'active',
    'legacy',
    NOW(),
    NOW()
FROM service_orders so
JOIN service_order_team_members tm
    ON tm.service_order_id = so.id
   AND tm.member_status <> 'removed'
WHERE so.fecha_agendada IS NOT NULL
  AND so.tecnico_id IS NOT NULL
  AND so.estado::text NOT IN (
      'cerrada',
      'cancelado',
      'rechazado'
  )
ON CONFLICT DO NOTHING;

-- Backfill para órdenes antiguas que todavía no tienen equipo V10.
INSERT INTO service_order_schedule_blocks (
    id,
    service_order_id,
    technician_id,
    block_role,
    start_at,
    end_at,
    status,
    source,
    created_at,
    updated_at
)
SELECT
    md5(
        so.id::text || ':' ||
        so.tecnico_id::text || ':v11-primary'
    )::uuid,
    so.id,
    so.tecnico_id,
    'primary',
    (
        (
            so.fecha_agendada::date +
            COALESCE(
                so.hora_inicio_agendada,
                '08:00:00'::time
            )
        ) AT TIME ZONE 'America/Bogota'
    ),
    (
        (
            so.fecha_agendada::date +
            COALESCE(
                so.hora_inicio_agendada,
                '08:00:00'::time
            )
        ) AT TIME ZONE 'America/Bogota'
    ) +
        make_interval(
            mins => COALESCE(
                so.duracion_estimada,
                60
            )
        ),
    'active',
    'legacy',
    NOW(),
    NOW()
FROM service_orders so
WHERE so.fecha_agendada IS NOT NULL
  AND so.tecnico_id IS NOT NULL
  AND so.estado::text NOT IN (
      'cerrada',
      'cancelado',
      'rechazado'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM service_order_team_members tm
      WHERE tm.service_order_id = so.id
        AND tm.member_status <> 'removed'
  )
ON CONFLICT DO NOTHING;

COMMIT;
