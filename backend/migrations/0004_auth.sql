-- 0004_auth.sql
-- Users table for NextAuth.js Google OAuth integration.
-- id: Google OAuth subject ID (sub claim) — stable unique identifier per Google account.
-- is_admin: set manually in the DB or via a future admin UI.

CREATE TABLE users (
    id         TEXT PRIMARY KEY,          -- Google sub
    email      TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    is_admin   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link bookings to the user who made them.
-- Nullable for backwards compatibility with seeded/anonymous bookings.
ALTER TABLE bookings ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_bookings_user ON bookings(user_id) WHERE user_id IS NOT NULL;

-- Verification token for QR code on tickets.
-- HMAC-SHA256(booking_id|created_at_unix, SECRET_KEY) truncated to 16 hex chars.
-- Stored at booking creation time; checked on /verify/[id] without a DB round-trip.
ALTER TABLE bookings ADD COLUMN verification_token TEXT;
CREATE INDEX idx_bookings_vtoken ON bookings(verification_token) WHERE verification_token IS NOT NULL;

-- Waitlist: also link to user
ALTER TABLE waitlist_entries ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
