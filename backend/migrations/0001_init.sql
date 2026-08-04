-- 0001_init.sql
-- Core schema for the segment-based train seat booking system.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Routes
CREATE TABLE routes (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

-- Stations
CREATE TABLE stations (
    id          SERIAL PRIMARY KEY,
    route_id    INT  NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    seq         INT  NOT NULL,
    distance_km NUMERIC(8,2) NOT NULL,
    zone        SMALLINT NOT NULL CHECK (zone BETWEEN 1 AND 5),
    UNIQUE (route_id, seq)
);

-- Coach class
CREATE TYPE coach_class AS ENUM ('first', 'second', 'third', 'unreserved');

-- Coaches
CREATE TABLE coaches (
    id           SERIAL PRIMARY KEY,
    route_id     INT         NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    coach_number TEXT        NOT NULL,
    class        coach_class NOT NULL,
    seat_count   INT         NOT NULL CHECK (seat_count > 0),
    display_order INT        NOT NULL DEFAULT 0,
    UNIQUE (route_id, coach_number)
);

-- Seats
CREATE TABLE seats (
    id          SERIAL PRIMARY KEY,
    coach_id    INT NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    seat_number INT NOT NULL,
    UNIQUE (coach_id, seat_number)
);

-- Trips
CREATE TYPE trip_direction AS ENUM ('outbound', 'inbound');

CREATE TABLE trips (
    id                    SERIAL PRIMARY KEY,
    route_id              INT            NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name                  TEXT           NOT NULL,
    service_date          DATE           NOT NULL,
    direction             trip_direction NOT NULL DEFAULT 'outbound',
    overnight_outbound    BOOLEAN        NOT NULL DEFAULT FALSE,
    overnight_inbound     BOOLEAN        NOT NULL DEFAULT FALSE,
    UNIQUE (route_id, name, service_date, direction)
);

-- Trip stops
CREATE TABLE trip_stops (
    id              SERIAL PRIMARY KEY,
    trip_id         INT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    station_id      INT  NOT NULL REFERENCES stations(id),
    seq_in_trip     INT  NOT NULL,
    arrival_time    TIME,
    departure_time  TIME,
    UNIQUE (trip_id, station_id),
    UNIQUE (trip_id, seq_in_trip)
);

CREATE INDEX idx_trip_stops_trip ON trip_stops(trip_id);

-- Bookings
CREATE TYPE passenger_type AS ENUM ('adult', 'child', 'student', 'senior');

CREATE TABLE bookings (
    id                SERIAL PRIMARY KEY,
    trip_id           INT            NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    seat_id           INT            NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    origin_station_id INT            NOT NULL REFERENCES stations(id),
    dest_station_id   INT            NOT NULL REFERENCES stations(id),
    seg               INT4RANGE      NOT NULL,
    passenger_name    TEXT           NOT NULL,
    passenger_type    passenger_type NOT NULL DEFAULT 'adult',
    fare              NUMERIC(10,2)  NOT NULL,
    status            TEXT           NOT NULL DEFAULT 'confirmed'
                          CHECK (status IN ('confirmed','cancelled')),
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CHECK (origin_station_id <> dest_station_id),

    EXCLUDE USING gist (
        trip_id WITH =,
        seat_id WITH =,
        seg     WITH &&
    ) WHERE (status = 'confirmed')
);

CREATE INDEX idx_bookings_trip_seat ON bookings(trip_id, seat_id) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_trip      ON bookings(trip_id)          WHERE status = 'confirmed';

-- Waitlist
CREATE TABLE waitlist_entries (
    id                  SERIAL PRIMARY KEY,
    trip_id             INT            NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    origin_station_id   INT            NOT NULL REFERENCES stations(id),
    dest_station_id     INT            NOT NULL REFERENCES stations(id),
    class               coach_class    NOT NULL,
    passenger_name      TEXT           NOT NULL,
    passenger_type      passenger_type NOT NULL DEFAULT 'adult',
    status              TEXT           NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting','promoted','cancelled')),
    promoted_booking_id INT REFERENCES bookings(id),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_trip ON waitlist_entries(trip_id, class) WHERE status = 'waiting';
