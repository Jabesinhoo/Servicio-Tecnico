BEGIN;

CREATE TABLE IF NOT EXISTS service_order_intake_team_members (
    id UUID PRIMARY KEY,
    intake_id UUID NOT NULL
        REFERENCES service_order_intakes(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    technician_id UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    member_role VARCHAR(20) NOT NULL DEFAULT 'support',
    added_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_intake_team_role_ck
        CHECK (member_role IN ('primary', 'support'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_order_intake_team_member
    ON service_order_intake_team_members (intake_id, technician_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_order_intake_primary
    ON service_order_intake_team_members (intake_id)
    WHERE member_role = 'primary';

CREATE INDEX IF NOT EXISTS idx_service_order_intake_team_technician
    ON service_order_intake_team_members (technician_id, added_at DESC);


CREATE TABLE IF NOT EXISTS service_order_team_members (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    technician_id UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    member_role VARCHAR(20) NOT NULL DEFAULT 'support',
    member_status VARCHAR(20) NOT NULL DEFAULT 'planned',
    added_by UUID NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMPTZ NULL,
    removed_at TIMESTAMPTZ NULL,
    removal_note TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_team_role_ck
        CHECK (member_role IN ('primary', 'support')),
    CONSTRAINT service_order_team_status_ck
        CHECK (member_status IN ('planned', 'assigned', 'removed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_order_team_active_member
    ON service_order_team_members (service_order_id, technician_id)
    WHERE member_status <> 'removed';

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_order_team_active_primary
    ON service_order_team_members (service_order_id)
    WHERE member_role = 'primary'
      AND member_status <> 'removed';

CREATE INDEX IF NOT EXISTS idx_service_order_team_technician
    ON service_order_team_members (
        technician_id,
        member_status,
        added_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_service_order_team_order
    ON service_order_team_members (
        service_order_id,
        member_status,
        member_role
    );


CREATE TABLE IF NOT EXISTS service_order_work_logs (
    id UUID PRIMARY KEY,
    service_order_id UUID NOT NULL
        REFERENCES service_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    technician_id UUID NOT NULL
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    activity_type VARCHAR(30) NOT NULL DEFAULT 'work',
    description TEXT NOT NULL,
    duration_minutes INTEGER NULL
        CHECK (
            duration_minutes IS NULL
            OR duration_minutes BETWEEN 1 AND 1440
        ),
    result_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_order_work_logs_type_ck
        CHECK (
            activity_type IN (
                'work',
                'diagnostic',
                'installation',
                'test',
                'support',
                'note'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_service_order_work_logs_order
    ON service_order_work_logs (
        service_order_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_service_order_work_logs_technician
    ON service_order_work_logs (
        technician_id,
        created_at DESC
    );

COMMIT;
