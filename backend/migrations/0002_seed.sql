-- 0002_seed.sql
-- Seed data for the Colombo Fort <-> Badulla upcountry line.

INSERT INTO routes (id, name) VALUES (1, 'Colombo Fort - Badulla') ;
SELECT setval('routes_id_seq', 1);

INSERT INTO stations (route_id, name, seq, distance_km) VALUES
    (1, 'Colombo Fort', 0, 0),
    (1, 'Rambukkana',   1, 65),
    (1, 'Kandy',        2, 121),
    (1, 'Hatton',       3, 187),
    (1, 'Nanu Oya',     4, 210),
    (1, 'Haputale',     5, 253),
    (1, 'Bandarawela',  6, 265),
    (1, 'Ella',         7, 282),
    (1, 'Badulla',      8, 294);

INSERT INTO coaches (route_id, coach_number, class, seat_count) VALUES
    (1, 'R1', 'reserved', 30),
    (1, 'R2', 'reserved', 30),
    (1, 'R3', 'reserved', 30),
    (1, 'U1', 'unreserved', 80),
    (1, 'U2', 'unreserved', 80),
    (1, 'U3', 'unreserved', 80),
    (1, 'U4', 'unreserved', 80),
    (1, 'U5', 'unreserved', 80);

INSERT INTO seats (coach_id, seat_number)
SELECT c.id, gs
FROM coaches c, generate_series(1, c.seat_count) gs
WHERE c.class = 'reserved';

INSERT INTO trips (route_id, name, service_date) VALUES
    (1, 'Podi Menike', CURRENT_DATE + 1),
    (1, 'Udarata Menike', CURRENT_DATE + 2);
