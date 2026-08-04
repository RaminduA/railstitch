-- 0002_seed.sql
-- Seed data for the Colombo Fort – Badulla upcountry express line

INSERT INTO routes (id, name) VALUES (1, 'Colombo Fort – Badulla');
SELECT setval('routes_id_seq', 1);

-- Stations
INSERT INTO stations (route_id, name, seq, distance_km, zone) VALUES
--  route  name                seq   km    zone
    (1, 'Colombo Fort',          0,    0,    1),
    (1, 'Maradana',              1,    2,    1),
    (1, 'Ragama',                2,   15,    1),
    (1, 'Gampaha',               3,   25,    1),
    (1, 'Veyangoda',             4,   36,    1),
    (1, 'Mirigama',              5,   54,    1),
    (1, 'Polgahawela',           6,   72,    1),
    (1, 'Rambukkana',            7,   80,    1),
    (1, 'Kadigamuwa',            8,   88,    1),
    (1, 'Ihalakotte',            9,   94,    1),
    (1, 'Balana',               10,   99,    1),
    (1, 'Kadugannawa',          11,  105,    1),
    (1, 'Pilimatalawa',         12,  112,    1),
    (1, 'Kandy',                13,  121,    1),
    (1, 'Sarasavi Uyana',       14,  123,    2),
    (1, 'Peradeniya',           15,  124,    2),
    (1, 'Geli Oya',             16,  133,    2),
    (1, 'Gampola',              17,  140,    2),
    (1, 'Tembiligala',          18,  146,    2),
    (1, 'Ulapane',              19,  152,    2),
    (1, 'Nawalapitiya',         20,  160,    2),
    (1, 'Inguruoya',            21,  167,    3),
    (1, 'Galaboda',             22,  172,    3),
    (1, 'Watawala',             23,  180,    3),
    (1, 'Ihalawatawala',        24,  184,    3),
    (1, 'Rozella',              25,  188,    3),
    (1, 'Hatton',               26,  195,    3),
    (1, 'Kotagala',             27,  201,    4),
    (1, 'Talawakele',           28,  206,    4),
    (1, 'Watagoda',             29,  211,    4),
    (1, 'Great Western',        30,  216,    4),
    (1, 'Radella',              31,  220,    4),
    (1, 'Nanuoya',              32,  224,    4),
    (1, 'Parakumpura',          33,  232,    4),
    (1, 'Ambewela',             34,  237,    4),
    (1, 'Pattipola',            35,  243,    4),
    (1, 'Ohiya',                36,  250,    4),
    (1, 'Idalgashinna',         37,  258,    4),
    (1, 'Haputale',             38,  263,    4),
    (1, 'Diyatalawa',           39,  267,    5),
    (1, 'Bandarawela',          40,  272,    5),
    (1, 'Kinigama',             41,  275,    5),
    (1, 'Heel Oya',             42,  278,    5),
    (1, 'Kital Ella',           43,  281,    5),
    (1, 'Ella',                 44,  284,    5),
    (1, 'Demodara',             45,  289,    5),
    (1, 'Uduwara',              46,  292,    5),
    (1, 'Hali Ela',             47,  296,    5),
    (1, 'Badulla',              48,  303,    5);

-- Coaches
INSERT INTO coaches (route_id, coach_number, class, seat_count, display_order) VALUES
--  route  coach_number  class    seat_count  display_order
    (1,     'AFC-1',       'first',   44,          1),
    (1,     'SC-1',        'second',  48,          2),
    (1,     'TC-1',        'third',   66,          3);

-- Seats
INSERT INTO seats (coach_id, seat_number)
SELECT c.id, gs
FROM coaches c, generate_series(1, c.seat_count) gs
WHERE c.class IN ('first', 'second', 'third');

-- Trips
INSERT INTO trips (id, route_id, name, service_date, direction, overnight_outbound, overnight_inbound)
VALUES
--  id  route       name            service_date       direction      overnight_outbound  overnight_inbound
    (1,     1,    'Podi Menike',    CURRENT_DATE + 1,  'outbound',       FALSE,              FALSE),
    (2,     1,    'Podi Menike',    CURRENT_DATE + 1,  'inbound',        FALSE,              FALSE),
    (3,     1,    'Udarata Menike', CURRENT_DATE + 2,  'outbound',       FALSE,              FALSE),
    (4,     1,    'Udarata Menike', CURRENT_DATE + 2,  'inbound',        FALSE,              FALSE);

SELECT setval('trips_id_seq', 4);

-- Trip stops helper: map station name to id

-- Podi Menike outbound: Colombo Fort → Badulla
INSERT INTO trip_stops (trip_id, station_id, seq_in_trip, arrival_time, departure_time)
SELECT 1, s.id, t.seq_in_trip, t.arr::TIME, t.dep::TIME
FROM (VALUES
--     station_name        seq_in_trip     arrival_time    departure_time
    ('Colombo Fort',           0,             NULL,             '05:55'),
    ('Ragama',                 1,             '06:16',          '06:18'),
    ('Gampaha',                3,             '06:30',          '06:31'),
    ('Veyangoda',              4,             '06:41',          '06:43'),
    ('Mirigama',               5,             '06:54',          '06:55'),
    ('Polgahawela',            6,             '07:15',          '07:17'),
    ('Rambukkana',             7,             '07:28',          '07:31'),
    ('Kadigamuwa',             8,             '07:42',          '07:43'),
    ('Ihalakotte',             9,             '07:53',          '07:54'),
    ('Balana',                 10,            '08:04',          '08:05'),
    ('Kadugannawa',            11,            '08:13',          '08:14'),
    ('Pilimatalawa',           12,            '08:20',          '08:25'),
    ('Kandy',                  13,            '08:46',          '08:57'),
    ('Peradeniya',             14,            '09:05',          '09:06'),
    ('Geli Oya',               15,            '09:14',          '09:15'),
    ('Gampola',                16,            '09:27',          '09:39'),
    ('Tembiligala',            17,            '09:45',          '09:46'),
    ('Ulapane',                18,            '09:53',          '09:54'),
    ('Nawalapitiya',           19,            '10:08',          '10:12'),
    ('Inguruoya',              20,            '10:23',          '10:24'),
    ('Galaboda',               21,            '10:35',          '10:36'),
    ('Watawala',               22,            '10:53',          '10:54'),
    ('Ihalawatawala',          23,            '10:59',          '11:00'),
    ('Rozella',                24,            '11:08',          '11:09'),
    ('Hatton',                 25,            '11:23',          '11:25'),
    ('Kotagala',               26,            '11:35',          '11:36'),
    ('Talawakele',             27,            '11:50',          '11:52'),
    ('Watagoda',               28,            '12:06',          '12:07'),
    ('Great Western',          29,            '12:17',          '12:22'),
    ('Radella',                30,            '12:30',          '12:31'),
    ('Nanuoya',                31,            '12:39',          '12:45'),
    ('Parakumpura',            32,            '12:56',          '12:57'),
    ('Ambewela',               33,            '13:16',          '13:17'),
    ('Pattipola',              34,            '13:24',          '13:25'),
    ('Ohiya',                  35,            '13:38',          '13:39'),
    ('Idalgashinna',           36,            '13:56',          '14:07'),
    ('Haputale',               37,            '14:21',          '14:22'),
    ('Diyatalawa',             38,            '14:32',          '14:34'),
    ('Bandarawela',            39,            '14:46',          '14:48'),
    ('Kinigama',               40,            '14:53',          '14:54'),
    ('Heel Oya',               41,            '15:02',          '15:03'),
    ('Kital Ella',             42,            '15:11',          '15:12'),
    ('Ella',                   43,            '15:17',          '15:19'),
    ('Demodara',               44,            '15:32',          '15:33'),
    ('Uduwara',                45,            '15:41',          '15:42'),
    ('Hali Ela',               46,            '15:50',          '15:51'),
    ('Badulla',                47,            '16:07',          NULL)
) AS t(station_name, seq_in_trip, arr, dep)
JOIN stations s ON s.name = t.station_name AND s.route_id = 1;

-- Podi Menike inbound: Badulla → Colombo Fort
INSERT INTO trip_stops (trip_id, station_id, seq_in_trip, arrival_time, departure_time)
SELECT 2, s.id, t.seq_in_trip, t.arr::TIME, t.dep::TIME
FROM (VALUES
--     station_name         seq_in_trip     arrival_time    departure_time
    ('Badulla',                 1,              NULL,           '08:30'),
    ('Hali Ela',                2,              '08:45',        '08:46'),
    ('Uduwara',                 3,              '08:54',        '08:55'),
    ('Demodara',                4,              '09:08',        '09:09'),
    ('Ella',                    5,              '09:23',        '09:24'),
    ('Kital Ella',              6,              '09:29',        '09:30'),
    ('Heel Oya',                7,              '09:38',        '09:39'),
    ('Kinigama',                8,              '09:48',        '09:49'),
    ('Bandarawela',             9,              '09:55',        '09:57'),
    ('Diyatalawa',              10,             '10:11',        '10:12'),
    ('Haputale',                11,             '10:24',        '10:26'),
    ('Idalgashinna',            12,             '10:43',        '10:44'),
    ('Ohiya',                   13,             '11:03',        '11:04'),
    ('Pattipola',               14,             '11:19',        '11:20'),
    ('Ambewela',                15,             '11:27',        '11:28'),
    ('Parakumpura',             16,             '11:47',        '11:48'),
    ('Nanuoya',                 17,             '11:58',        '12:03'),
    ('Radella',                 18,             '12:11',        '12:12'),
    ('Great Western',           19,             '12:20',        '12:21'),
    ('Watagoda',                20,             '12:31',        '12:32'),
    ('Talawakele',              21,             '12:46',        '12:48'),
    ('Kotagala',                22,             '13:02',        '13:03'),
    ('Hatton',                  23,             '13:13',        '13:24'),
    ('Rozella',                 24,             '13:38',        '13:39'),
    ('Ihalawatawala',           25,             '13:48',        '13:49'),
    ('Watawala',                26,             '13:54',        '14:10'),
    ('Galaboda',                27,             '14:27',        '14:28'),
    ('Inguruoya',               28,             '14:39',        '14:40'),
    ('Nawalapitiya',            29,             '14:51',        '14:55'),
    ('Ulapane',                 30,             '15:07',        '15:08'),
    ('Tembiligala',             31,             '15:14',        '15:15'),
    ('Gampola',                 32,             '15:22',        '15:23'),
    ('Kandy',                   33,             '15:53',        '16:00'),
    ('Sarasavi Uyana',          34,             '16:07',        '16:08'),
    ('Peradeniya',              35,             '16:10',        '16:11'),
    ('Pilimatalawa',            36,             '16:19',        '16:20'),
    ('Kadugannawa',             37,             '16:27',        '16:28'),
    ('Ihalakotte',              38,             '16:50',        '16:51'),
    ('Kadigamuwa',              39,             '17:02',        '17:12'),
    ('Rambukkana',              40,             '17:23',        '17:26'),
    ('Polgahawela',             41,             '17:37',        '17:39'),
    ('Veyangoda',               42,             '18:09',        '18:11'),
    ('Gampaha',                 43,             '18:22',        '18:23'),
    ('Ragama',                  44,             '18:34',        '18:35'),
    ('Maradana',                45,             '18:51',        NULL),
    ('Colombo Fort',            46,             '18:57',        NULL)
) AS t(station_name, seq_in_trip, arr, dep)
JOIN stations s ON s.name = t.station_name AND s.route_id = 1;

-- Udarata Menike outbound: Colombo Fort → Badulla
INSERT INTO trip_stops (trip_id, station_id, seq_in_trip, arrival_time, departure_time)
SELECT 3, s.id, t.seq_in_trip, t.arr::TIME, t.dep::TIME
FROM (VALUES
--     station_name        seq_in_trip     arrival_time    departure_time
    ('Colombo Fort',            1,              NULL,           '08:30'),
    ('Ragama',                  2,              '08:50',        '08:51'),
    ('Gampaha',                 3,              '09:01',        '09:02'),
    ('Veyangoda',               4,              '09:11',        '09:12'),
    ('Polgahawela',             5,              '09:43',        '09:44'),
    ('Rambukkana',              6,              '09:55',        '09:58'),
    ('Kadugannawa',             7,              '10:37',        '10:38'),
    ('Kandy',                   8,              '11:03',        '11:10'),
    ('Peradeniya',              9,              '11:18',        '11:19'),
    ('Gampola',                 10,             '11:36',        '11:37'),
    ('Ulapane',                 11,             '11:49',        '11:50'),
    ('Nawalapitiya',            12,             '12:02',        '12:07'),
    ('Inguruoya',               13,             '12:18',        '12:19'),
    ('Galaboda',                14,             '12:30',        '12:31'),
    ('Watawala',                15,             '12:48',        '12:49'),
    ('Ihalawatawala',           16,             '12:54',        '12:55'),
    ('Rozella',                 17,             '13:04',        '13:05'),
    ('Hatton',                  18,             '13:19',        '13:21'),
    ('Kotagala',                19,             '13:31',        '13:32'),
    ('Talawakele',              20,             '13:46',        '13:47'),
    ('Watagoda',                21,             '14:01',        '14:02'),
    ('Great Western',           22,             '14:12',        '14:16'),
    ('Radella',                 23,             '14:24',        '14:25'),
    ('Nanuoya',                 24,             '14:33',        '14:36'),
    ('Parakumpura',             25,             '14:47',        '14:48'),
    ('Ambewela',                26,             '15:05',        '15:06'),
    ('Pattipola',               27,             '15:13',        '15:14'),
    ('Ohiya',                   28,             '15:27',        '15:28'),
    ('Idalgashinna',            29,             '15:45',        '15:46'),
    ('Haputale',                30,             '16:01',        '16:02'),
    ('Diyatalawa',              31,             '16:12',        '16:13'),
    ('Bandarawela',             32,             '16:27',        '16:28'),
    ('Kinigama',                33,             '16:33',        '16:34'),
    ('Heel Oya',                34,             '16:42',        '16:43'),
    ('Kital Ella',              35,             '16:50',        '16:51'),
    ('Ella',                    36,             '16:56',        '16:57'),
    ('Demodara',                37,             '17:10',        '17:11'),
    ('Uduwara',                 38,             '17:48',        '17:49'),
    ('Hali Ela',                39,             '17:57',        '18:07'),
    ('Badulla',                 40,             '18:22',        NULL)
) AS t(station_name, seq_in_trip, arr, dep)
JOIN stations s ON s.name = t.station_name AND s.route_id = 1;

-- Udarata Menike inbound: Badulla → Colombo Fort
INSERT INTO trip_stops (trip_id, station_id, seq_in_trip, arrival_time, departure_time)
SELECT 4, s.id, t.seq_in_trip, t.arr::TIME, t.dep::TIME
FROM (VALUES
--     station_name        seq_in_trip     arrival_time    departure_time
    ('Badulla',                 1,              NULL,           '05:45'),
    ('Hali Ela',                2,              '06:00',        '06:01'),
    ('Uduwara',                 3,              '06:09',        '06:10'),
    ('Demodara',                4,              '06:23',        '06:24'),
    ('Ella',                    5,              '06:39',        '06:40'),
    ('Kital Ella',              6,              '06:45',        '06:46'),
    ('Heel Oya',                7,              '06:54',        '06:55'),
    ('Kinigama',                8,              '07:04',        '07:05'),
    ('Bandarawela',             9,              '07:11',        '07:14'),
    ('Diyatalawa',              10,             '07:28',        '07:29'),
    ('Haputale',                11,             '07:41',        '07:43'),
    ('Idalgashinna',            12,             '07:59',        '08:00'),
    ('Ohiya',                   13,             '08:20',        '08:21'),
    ('Pattipola',               14,             '08:36',        '08:37'),
    ('Ambewela',                15,             '08:45',        '08:46'),
    ('Parakumpura',             16,             '09:05',        '09:06'),
    ('Nanuoya',                 17,             '09:16',        '09:22'),
    ('Radella',                 18,             '09:30',        '09:31'),
    ('Great Western',           19,             '09:39',        '09:40'),
    ('Watagoda',                20,             '09:52',        '09:53'),
    ('Talawakele',              21,             '10:08',        '10:12'),
    ('Kotagala',                22,             '10:25',        '10:26'),
    ('Hatton',                  23,             '10:37',        '10:45'),
    ('Rozella',                 24,             '11:00',        '11:10'),
    ('Ihalawatawala',           25,             '11:18',        '11:19'),
    ('Watawala',                26,             '11:24',        '11:25'),
    ('Galaboda',                27,             '11:42',        '11:43'),
    ('Inguruoya',               28,             '11:54',        '11:55'),
    ('Nawalapitiya',            29,             '12:06',        '12:10'),
    ('Ulapane',                 30,             '12:22',        '12:23'),
    ('Gampola',                 31,             '12:35',        '12:36'),
    ('Kandy',                   32,             '13:03',        '13:10'),
    ('Sarasavi Uyana',          33,             '13:17',        '13:18'),
    ('Peradeniya',              34,             '13:20',        '13:21'),
    ('Pilimatalawa',            35,             '13:30',        '13:31'),
    ('Kadugannawa',             36,             '13:37',        '13:38'),
    ('Rambukkana',              37,             '14:17',        '14:19'),
    ('Polgahawela',             38,             '14:30',        '14:31'),
    ('Veyangoda',               39,             '15:01',        '15:02'),
    ('Gampaha',                 40,             '15:12',        '15:13'),
    ('Ragama',                  41,             '15:26',        '15:27'),
    ('Maradana',                42,             '15:41',        NULL),
    ('Colombo Fort',            43,             '15:47',        NULL)
) AS t(station_name, seq_in_trip, arr, dep)
JOIN stations s ON s.name = t.station_name AND s.route_id = 1;
