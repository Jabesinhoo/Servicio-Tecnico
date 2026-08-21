

BEGIN;

CREATE TABLE IF NOT EXISTS user_login_events (
    id UUID PRIMARY KEY,
    user_id UUID NULL,
    identifier VARCHAR(255) NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(64) NULL,
    user_agent TEXT NULL,
    failure_reason VARCHAR(120) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_login_events_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_login_events_user_created
    ON user_login_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_login_events_created
    ON user_login_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_login_events_success
    ON user_login_events (success);

COMMIT;
