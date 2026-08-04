# Railstitch

A segment-based seat booking system for Sri Lanka's Colombo Fort-Badulla upcountry express line. The core idea: a reserved seat vacated midway through a journey becomes available again for another passenger where each person pays only for the distance they actually travel.


## Core features

This implementation addresses the core requirements of the challenge by providing:

- **Segment-based booking:** A reserved seat becomes available again once the passenger leaves the train. Reservations are tracked by station segments rather than the entire route.
- **Concurrency-safe booking:** Database-level guarantees prevent overlapping reservations for the same seat even under concurrent requests.
- **Passenger booking flow:** Passengers can choose a train, date, origin, destination, view seat availability for that specific leg, and make a reservation.
- **Backend API:** APIs manage stations, trips, seats, bookings, availability and administration.
- **Configurable railway model:** Stations, coaches, seats and trips are data-driven rather than hardcoded, allowing future expansion without code changes.



## Running the project

**Prerequisites:** Docker and Docker Compose.

```bash
git clone https://github.com/RaminduA/railstitch.git
cd railstitch
cp .env.example .env
docker-compose up --build
```

The app will be available at **http://localhost:3000**. The API runs on port 8080. On first boot, Postgres automatically runs the three migration files in order: schema, seed data (49 stations, coaches, timetables for both trains), and the days-off table.

> If you need to reset the database (e.g. after a schema migration), run:
> `docker-compose down -v && docker-compose up --build`


## Architecture

```
railstitch/
├── backend/          Go 1.25 + chi router + lib/pq
│   ├── cmd/api/      Entrypoint and route wiring
│   ├── internal/
│   │   ├── db/       Connection pool + constraint violation detection
│   │   ├── fare/     Hybrid pricing (pure + DB-querying variants)
│   │   ├── handlers/ HTTP handlers for all endpoints
│   │   └── models/   Domain types
│   └── migrations/   3 sequential SQL migrations (auto-run by Postgres on first boot)
├── frontend/         Next.js 16 + Tailwind v4 + TypeScript
│   └── src/
│       ├── app/      App Router pages
│       └── components/ Shared components (RouteRail, SeatPicker, Logo)
└── docker-compose.yml  Three services: db, api, frontend
```

**Backend:** Go was chosen over Python/FastAPI for this use case because the interesting engineering problem (concurrency correctness) is more naturally expressed in Go's error-handling style. `if db.IsExclusionViolation(err) { continue }` reads clearly. No ORM is used; all SQL is plain and visible, making the exclusion constraint logic straightforward to reason about and audit.

**Database:** PostgreSQL was the only realistic choice. The `EXCLUDE USING gist` constraint requires `btree_gist`, a PostgreSQL-specific extension. No NoSQL database provides an equivalent atomic overlap guarantee. The booking correctness guarantee is not replicated in application code, it lives in a single DDL statement.

**Frontend:** Next.js App Router with server components for data fetching (trips, stops, availability) and client components for interactive state (RouteRail station picker, date picker, seat map). Tailwind v4 with a custom Ceylon railway design system (tea-estate green, brass, aged-paper cream).


## Core design decisions

### Segment occupancy: PostgreSQL exclusion constraints

The central problem is guaranteeing that no two confirmed bookings on the same seat can overlap in time (station range), even under concurrent load.

**The approach:** each booking stores its leg as an `INT4RANGE`, a half-open interval `[origin_seq, dest_seq)` of station sequence numbers. A PostgreSQL exclusion constraint using `btree_gist` enforces that no two confirmed bookings on the same `(trip_id, seat_id)` may have overlapping ranges:

```sql
EXCLUDE USING gist (
    trip_id WITH =,
    seat_id WITH =,
    seg     WITH &&
) WHERE (status = 'confirmed')
```

This means correctness is guaranteed at the database level, not application level. Two concurrent booking requests for the same seat on overlapping legs both attempt an INSERT; one succeeds, the other receives SQLSTATE 23P01 (exclusion violation). The application catches this, retries with the next available seat, and surfaces a clean conflict message to the user. No manual locking, no SELECT-then-INSERT races.

**Alternatives considered:**
- *Application-level check-then-insert:* rejected because of TOCTOU (time-of-check-time-of-use) races where two requests reading "seat is free" before either inserts can both succeed, producing a double booking.
- *Row-level locking with `SELECT FOR UPDATE`:* works but requires explicit lock management in application code and doesn't scale as cleanly under high concurrency.
- *One row per atomic station pair (segment table):* simpler overlap check, but multiplies row count and makes cancellation/waitlist logic more complex for no real benefit on a linear route.

Cancellation sets `status = 'cancelled'`, which immediately removes the booking from the exclusion constraint's `WHERE` clause, freeing the segment without any additional cleanup step.

### Fares: hybrid pricing model

Fares use a five-factor model rather than simple distance pricing:

```
fare = round_to_10(
    base_fare (Rs. 180)
    × zone_multiplier      (0 crossings=1.0×, 1=1.7×, 2=2.3×, 3=2.8×, 4=3.2×)
    × class_multiplier     (3rd=1.0×, 2nd=1.8×, 1st=3.0× as per SLR gazette)
    × demand_multiplier    (<30% occupied=0.85×, 30-60%=1.0×, 60-80%=1.2×, >80%=1.5×)
    × time_multiplier      (>14 days ahead=0.9×, same day=1.5×)
    × passenger_multiplier (adult=1.0×, student=0.7×, senior=0.75×, child=0.5×)
)
```

**Zone boundaries** follow natural geographic breaks meaningful to Sri Lankan travellers: Colombo Fort→Kandy (Zone 1), Kandy→Nawalapitiya (Zone 2), Nawalapitiya→Hatton (Zone 3), Hatton→Haputale (Zone 4), Haputale→Badulla (Zone 5).

**What we deliberately do not do:** charge a partial-journey passenger as if they occupied the seat for the rest of the route. The old system's "pay for the whole journey" premium existed because a reserved seat couldn't be resold after departure. This system removes that constraint where each passenger pays only for the distance they travel.

The fare module provides two implementations: `QuoteWithoutDB` (pure function, occupancy passed in by the caller, currently used in production) and `Quote` (queries occupancy from the database directly). Swapping between them is a one-line change at the call site.

**Alternatives considered:**
- *Pure per-km pricing (like old SLR):* too simple, doesn't capture demand variation or class differences meaningfully.
- *Fixed stage fares (raw SLR gazette):* accurate but rigid and not interesting to model in software.
- *Scenic-corridor surcharge (Nanu Oya-Ella):* considered and dropped as zone-based pricing already captures the higher value of that segment through Zone 4 and 5 crossings, without needing an arbitrary extra overlay.

### Trip creation: on-demand, not pre-seeded

Trips are created when the first passenger clicks "Proceed" for a given train/date/direction, not by an admin scheduling them in advance. The `POST /api/trips/find-or-create` endpoint handles this:

1. Validates the date is not in the past and not a day off.
2. Attempts `INSERT ... ON CONFLICT DO NOTHING`, race-safe even if two passengers click Proceed simultaneously.
3. Copies `trip_stops` (scheduled timetable times) from a template trip of the same name and direction that was seeded at startup.

This means the system scales to any future date without admin intervention, while keeping the timetable data accurate (it always comes from the seeded real timetable).

### Database schema design

**Configurable by design:** coaches, seats, and stations are all data rows, not code. Adding a coach is an `INSERT`; extending the route is an `INSERT`. The number of seats per coach and the station list can change without a deployment.

**Trip direction:** stored as an enum (`outbound`/`inbound`) per trip. The Route Rail diagram uses this to assign origin/destination correctly regardless of which dot the passenger taps first.

**Overnight flag:** `overnight_outbound` and `overnight_inbound` columns on trips allow future night services where departure times cross midnight. Both current trains complete within the same calendar day, so these are `FALSE`, but the infrastructure exists.

### Concurrency under load: verified

The booking creation endpoint was tested with 20 truly concurrent requests for the same seat on the same overlapping leg. Result: exactly 1 succeeded, 19 received 409. No double bookings, no application-level locking required.


## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes/:id/stations` | All stations with zone and distance |
| GET | `/api/trips` | All trips (route_id query param) |
| GET | `/api/trips/:id/stops` | Timetable stops with can_board flag |
| GET | `/api/trips/:id/availability?origin=&dest=` | All seats with availability/blocking info |
| POST | `/api/trips/:id/bookings` | Create booking (handles concurrency) |
| GET | `/api/trips/:id/bookings` | All bookings for a trip |
| GET | `/api/bookings/:id` | Single booking by ID |
| DELETE | `/api/bookings/:id` | Cancel booking + trigger waitlist promotion |
| POST | `/api/trips/find-or-create` | Create trip on demand for a date/direction |
| POST | `/api/trips/:id/waitlist` | Join waitlist for a leg |
| GET | `/api/trips/:id/waitlist` | List waitlist entries |
| GET | `/api/admin/trips/:id/summary` | Occupancy and revenue summary |
| GET | `/api/admin/days-off` | List all days off |
| POST | `/api/admin/days-off` | Add a day off |
| DELETE | `/api/admin/days-off/:day` | Remove a day off |
| GET | `/api/admin/days-off/range?from=&to=` | Days off in date range (used by date picker) |


## Extra credit features

### Seat map visualization

The booking flow shows a top-down visual diagram of each coach interior, not a flat numbered list. Each class has its real SLR layout: AFC (1st class) 2+2 in 11 rows (44 seats), SC (2nd class) 2+2 in 12 rows (48 seats), TC (3rd class) 3+3 in 11 rows (66 seats). Occupied seats render in red with a tooltip showing which leg they're reserved for (`Reserved: Kandy → Hatton`). The three coaches render in class order, 1st at top, 3rd at bottom, matching the physical train layout.

### Waitlisting for fully booked segments

When no reserved seats are available for a requested leg, passengers can join a FIFO waitlist. On cancellation, the system automatically promotes the oldest waiting entry: it queries current availability and attempts `tryInsertBooking` (the same path as a normal booking, with the same exclusion-constraint safety net). If a concurrent cancellation already filled the seat, it tries the next candidate. Waitlist promotion is transparent, the passenger simply finds their booking confirmed.

### Admin view (occupancy, revenue, days off)

A department-facing admin panel at `/admin` with two sections:

**Occupancy & Revenue:** select a train, direction, and date and the system finds or creates the trip and shows per-leg occupancy bars, total revenue, and booking counts. Occupancy is computed per *atomic leg* (adjacent station pair), not for the route as a whole, this is the only granularity that's meaningful for a segment-bookable seat, since the same seat can be occupied on one leg and free on another simultaneously.

**Days Off:** admins can block specific dates (public holidays, maintenance windows). Blocked dates appear struck-through in the passenger-facing date picker and prevent booking creation via the API.

### Fare logic beyond distance-based pricing

The five-factor hybrid model described above. Key decisions worth highlighting:

- **Zone-based** rather than per-km: more intuitive for passengers, captures the meaningful price steps between geographic regions (lowland→hill country→high plateau→descent).
- **Demand-based**: occupancy of a leg at booking time affects price. Early bookers pay less; popular legs near capacity cost more. The data to compute this (per-leg occupancy) is already produced by the admin endpoint.
- **Time-based**: booking close to departure costs more. This incentivises advance planning and helps fill seats early.
- **Class-based**: per SLR gazette multipliers (1st class = 3× base, 2nd = 1.8×, 3rd = 1.0×). Class is determined by which coach the seat is in, the passenger picks a seat, the fare follows automatically.

### Real-time conflict handling

The availability endpoint returns *all* seats (not just available ones), with each seat flagged `available: true/false` and occupied seats annotated with `blocked_origin`/`blocked_dest`. The seat map renders occupied seats in red with a hover tooltip. When a booking attempt loses a race (exclusion violation), the frontend automatically refreshes availability and shows a clear message rather than a generic error.

### Route Rail: interactive station diagram

The origin/destination picker is a horizontal diagram of the actual 49-station route, with stations spaced proportionally by real cumulative distance. Stations that a particular train doesn't stop at are shown greyed-out with a tooltip. Stations already passed (based on scheduled departure time vs current clock) are disabled with a "train has already departed" tooltip. Zone transitions are colour-coded. Selecting two stops is direction-aware: the system assigns origin/destination based on the trip's direction, not the order of taps.


## Challenges

**The zone boundary problem:** with stations as close as 3-9 km apart near zone boundaries, any zone system produces short cross-boundary hops that feel expensive relative to equivalent intra-zone hops. This is a known property of zone-based transit pricing (every real-world metro system has the same issue) and was accepted as a reasonable trade-off rather than papered over with an arbitrary distance cap.

**Station spacing in the Route Rail:** 49 stations, many clustered tightly (Haputale/Diyatalawa/Bandarawela/Kinigama are all within 12 km). A purely distance-proportional layout caused label collisions. The fix: enforce a minimum pixel gap between stations, which distorts the diagram slightly but is consistent with how real railway route diagrams handle this, they deliberately distort distance for legibility.

**Docker volume and migrations:** PostgreSQL only runs `docker-entrypoint-initdb.d/` scripts on a fresh (empty) volume. When adding new migrations mid-project, `docker-compose down -v` is required to wipe and reinitialize. Documented clearly in the running instructions above.