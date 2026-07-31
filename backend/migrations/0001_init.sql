-- 0001_init.sql
-- Core schema for the segment based train seat booking system.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE routes (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE stations (
    id          SERIAL PRIMARY KEY,
    route_id    INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    seq         INT NOT NULL,
    distance_km NUMERIC(10,2) NOT NULL,
    UNIQUE (route_id, seq)
);

CREATE TYPE coach_class AS ENUM ('reserved', 'unreserved');

CREATE TABLE coaches (
    id           SERIAL PRIMARY KEY,
    route_id     INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    coach_number TEXT NOT NULL,
    class        coach_class NOT NULL,
    seat_count   INT NOT NULL CHECK (seat_count > 0),
    UNIQUE (route_id, coach_number)
);

CREATE TABLE seats (
    id          SERIAL PRIMARY KEY,
    coach_id    INT NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    seat_number INT NOT NULL,
    UNIQUE (coach_id, seat_number)
);

CREATE TABLE trips (
    id           SERIAL PRIMARY KEY,
    route_id     INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    service_date DATE NOT NULL,
    UNIQUE (route_id, name, service_date)
);

CREATE TABLE bookings (
    id                SERIAL PRIMARY KEY,
    trip_id           INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    seat_id           INT NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    origin_station_id INT NOT NULL REFERENCES stations(id),
    dest_station_id   INT NOT NULL REFERENCES stations(id),
    seg               INT4RANGE NOT NULL,
    passenger_name    TEXT NOT NULL,
    fare              NUMERIC(10,2) NOT NULL,
    status            TEXT NOT NULL DEFAULT 'confirmed'
                          CHECK (status IN ('confirmed','cancelled')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (origin_station_id <> dest_station_id),

    EXCLUDE USING gist (
        trip_id WITH =,
        seat_id WITH =,
        seg     WITH &&
    ) WHERE (status = 'confirmed')
);

CREATE INDEX idx_bookings_trip_seat ON bookings(trip_id, seat_id) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_trip ON bookings(trip_id) WHERE status = 'confirmed';

CREATE TABLE waitlist_entries (
    id                SERIAL PRIMARY KEY,
    trip_id           INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    origin_station_id INT NOT NULL REFERENCES stations(id),
    dest_station_id   INT NOT NULL REFERENCES stations(id),
    class             coach_class NOT NULL,
    passenger_name    TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'waiting'
                          CHECK (status IN ('waiting','promoted','cancelled')),
    promoted_booking_id INT REFERENCES bookings(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_trip ON waitlist_entries(trip_id, class) WHERE status = 'waiting';