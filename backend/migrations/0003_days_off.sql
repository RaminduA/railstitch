-- 0003_days_off.sql
-- Days when train services are suspended (public holidays, maintenance, etc.)
-- Seeded empty -- admins add entries via POST /api/admin/days-off.
-- The date picker on the booking frontend fetches this list and blocks
-- those dates so passengers can't book a trip that won't run.

CREATE TABLE days_off (
    id         SERIAL PRIMARY KEY,
    day        DATE    NOT NULL UNIQUE,
    reason     TEXT    NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_days_off_day ON days_off(day);
