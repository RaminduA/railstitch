# Railstitch

A segment-based seat booking system for Sri Lanka's Colombo Fort-Badulla upcountry express line. The core idea: a reserved seat vacated midway through a journey becomes available again for another passenger where each person pays only for the distance they actually travel.

Live demo: https://railstitch.vercel.app


## Core features

- **Segment-based booking:** A reserved seat becomes available again once the passenger leaves the train. Reservations are tracked by station segments rather than the entire route.
- **Concurrency-safe booking:** Database-level guarantees prevent overlapping reservations for the same seat even under concurrent requests.
- **Passenger booking flow:** Passengers can choose a train, date, origin, destination, view seat availability for that specific leg, and make a reservation.
- **Backend API:** APIs manage stations, trips, seats, bookings, availability and administration.
- **Configurable railway model:** Stations, coaches, seats and trips are data-driven rather than hardcoded, allowing future expansion without code changes.
- **Authentication:** Google OAuth via NextAuth.js. Signing in creates an account automatically. Admins and passengers have separate dashboards and access controls.
- **Physical ticket with QR code:** Each booking generates a printable ticket styled after the real SLR paper ticket format, with a QR code linking to a public verification page.


## Running the project

**Prerequisites:** Docker and Docker Compose.

```bash
git clone https://github.com/RaminduA/railstitch.git
cd railstitch
cp .env.example .env
docker-compose up --build
```

The app will be available at http://localhost:3000. The API runs on port 8080. On first boot, Postgres automatically runs all four migration files in order: schema, seed data (49 stations, coaches, timetables for both trains), days-off table, and auth table.

> If you need to reset the database (e.g. after a schema migration), run:
> `docker-compose down -v && docker-compose up --build`


## Environment variables

Copy `.env.example` to `.env` and fill in the values before running.

```
POSTGRES_USER=postgres_user
POSTGRES_PASSWORD=postgres_password
POSTGRES_DB=railstitch_db

HMAC_SECRET=<run: openssl rand -hex 32>

ADMIN_EMAILS=your@email.com
```

Create `frontend/.env.local` with:

```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

In Google Cloud Console, add `http://localhost:3000/api/auth/callback/google` as an authorised redirect URI for your OAuth client.


## Admin access

Admins are seeded from the `ADMIN_EMAILS` environment variable (comma-separated). Set this in `.env` before running `docker-compose up --build`. Any Google account whose email matches the list gets `is_admin = TRUE` automatically on the API's first startup.

To grant admin access to a grader:

1. Open `.env`
2. Set `ADMIN_EMAILS=grader@example.com` (or `ADMIN_EMAILS=existing@email.com,grader@example.com` for multiple)
3. Run `docker-compose down -v && docker-compose up --build`

The grader signs in with Google using that email address and is taken directly to the admin dashboard.


## Architecture

```
railstitch/
|-- backend/          Go 1.25 + chi router + lib/pq + gorilla/websocket
|   |-- cmd/api/      Entrypoint, route wiring, admin email seeding
|   |-- internal/
|   |   |-- db/       Connection pool + constraint violation detection
|   |   |-- fare/     Hybrid pricing (pure + DB-querying variants)
|   |   |-- handlers/ HTTP handlers for all endpoints
|   |   `-- models/   Domain types
|   `-- migrations/   4 sequential SQL migrations (auto-run by Postgres on first boot)
|-- frontend/         Next.js 16 + Tailwind v4 + TypeScript + NextAuth v4
|   `-- src/
|       |-- app/      App Router pages (passenger + admin + public verify)
|       |-- components/ RouteRail, SeatPicker, SiteHeader, SiteFooter, Logo
|       `-- lib/      API client, auth helpers, booking state helpers
`-- docker-compose.yml  Three services: db, api, frontend
```

**Backend:** Go was chosen over Python/FastAPI for this use case because the interesting engineering problem (concurrency correctness) is more naturally expressed in Go's error-handling style. `if db.IsExclusionViolation(err) { continue }` reads clearly. No ORM is used; all SQL is plain and visible, making the exclusion constraint logic straightforward to reason about and audit.

**Database:** PostgreSQL was the only realistic choice. The `EXCLUDE USING gist` constraint requires `btree_gist`, a PostgreSQL-specific extension. No NoSQL database provides an equivalent atomic overlap guarantee. The booking correctness guarantee is not replicated in application code, it lives in a single DDL statement.

**Frontend:** Next.js App Router with server components for data fetching (trips, stops, availability) and client components for interactive state (RouteRail station picker, date picker, seat map). Tailwind v4 with a custom Ceylon railway design system (tea-estate green, brass, aged-paper cream). NextAuth v4 handles Google OAuth with role-based session tokens.


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
- *Row-level locking with SELECT FOR UPDATE:* works but requires explicit lock management in application code and does not scale as cleanly under high concurrency.
- *One row per atomic station pair (segment table):* simpler overlap check, but multiplies row count and makes cancellation and waitlist logic more complex for no real benefit on a linear route.

Cancellation sets `status = 'cancelled'`, which immediately removes the booking from the exclusion constraint's WHERE clause, freeing the segment without any additional cleanup step.


### Fares: hybrid pricing model

Fares use a five-factor model rather than simple distance pricing:

```
fare = round_to_10(
    base_fare (Rs. 180)
    x zone_multiplier      (0 crossings=1.0x, 1=1.7x, 2=2.3x, 3=2.8x, 4=3.2x)
    x class_multiplier     (3rd=1.0x, 2nd=1.8x, 1st=3.0x as per SLR gazette)
    x demand_multiplier    (<30% occupied=0.85x, 30-60%=1.0x, 60-80%=1.2x, >80%=1.5x)
    x time_multiplier      (>14 days ahead=0.9x, same day=1.5x)
    x passenger_multiplier (adult=1.0x, student=0.7x, senior=0.75x, child=0.5x)
)
```

**Zone boundaries** follow natural geographic breaks: Colombo Fort to Kandy (Zone 1), Kandy to Nawalapitiya (Zone 2), Nawalapitiya to Hatton (Zone 3), Hatton to Haputale (Zone 4), Haputale to Badulla (Zone 5).

**What we deliberately do not do:** charge a partial-journey passenger as if they occupied the seat for the rest of the route. Each passenger pays only for the distance they travel.

The fare module provides two implementations: `QuoteWithoutDB` (pure function, occupancy passed in by the caller, currently used in production) and `Quote` (queries occupancy from the database directly). Swapping between them is a one-line change at the call site.

**Alternatives considered:**
- *Pure per-km pricing (like old SLR):* too simple, does not capture demand variation or class differences meaningfully.
- *Fixed stage fares (raw SLR gazette):* accurate but rigid and not interesting to model in software.
- *Scenic-corridor surcharge (Nanu Oya-Ella):* considered and dropped as zone-based pricing already captures the higher value of that segment through Zone 4 and 5 crossings.


### Trip creation: on-demand, not pre-seeded

Trips are created when the first passenger clicks "Proceed" for a given train/date/direction, not by an admin scheduling them in advance. The `POST /api/trips/find-or-create` endpoint handles this:

1. Validates the date is not in the past and not a day off.
2. Attempts `INSERT ... ON CONFLICT DO NOTHING`, race-safe even if two passengers click Proceed simultaneously.
3. Copies `trip_stops` (scheduled timetable times) from a template trip of the same name and direction that was seeded at startup.

This means the system scales to any future date without admin intervention, while keeping the timetable data accurate (it always comes from the seeded real timetable).


### Authentication and role separation

Google OAuth is used via NextAuth.js. On first sign-in, the user is upserted into the `users` table. Admin status is seeded from the `ADMIN_EMAILS` environment variable at API startup -- any email in that list gets `is_admin = TRUE` in the database before any user signs in, so the admin sees the admin dashboard immediately on first login.

Role enforcement happens at two layers:

- **Next.js proxy (proxy.ts):** intercepts every request and redirects based on the JWT token's `isAdmin` claim. Passengers cannot reach `/admin/*`. Admins cannot reach `/trains/*` or `/booking-history`.
- **Session callbacks:** `is_admin` is fetched from the database at JWT creation time and cached in the token, so every subsequent request reads from the token without a database round-trip.


### Real-time station tracking

The Route Rail diagram greys out stations from which the train has already departed. Two strategies are implemented, switchable via a single constant in `RouteRail.tsx`:

**Strategy 1 (active): Schedule-based.** A 30-second interval compares the current wall-clock time against scheduled departure times from the timetable. Only applies when the booking date is today. For future dates, no stations are greyed.

**Strategy 2 (ready to wire): Live GPS WebSocket feed.** A WebSocket endpoint exists at `GET /api/trips/:id/live`. When connected, the server emits `{ trip_id, station_id, station_name, departed_at }` messages as each station's scheduled departure time passes. The frontend code for consuming this feed is written and fully typed -- switching to it requires changing one constant from `TrackingStrategy.Schedule` to `TrackingStrategy.LiveFeed`. In production, the server-side timer emissions would be replaced with real GPS feed events without any frontend changes.

Strategy 1 is acknowledged to be inaccurate for Sri Lanka's railways since trains frequently run late. Strategy 2 was designed with this in mind.


### Database schema design

**Configurable by design:** coaches, seats, and stations are all data rows, not code. Adding a coach is an INSERT; extending the route is an INSERT. The number of seats per coach and the station list can change without a deployment.

**Trip direction:** stored as an enum (`outbound`/`inbound`) per trip. The Route Rail diagram reverses station order for inbound trips so the origin is always on the left.

**Overnight flag:** `overnight_outbound` and `overnight_inbound` columns on trips allow future night services where departure times cross midnight. Both current trains complete within the same calendar day so these are FALSE, but the infrastructure exists.


### Concurrency under load: verified

The booking creation endpoint was tested with 20 truly concurrent requests for the same seat on the same overlapping leg. Result: exactly 1 succeeded, 19 received 409. No double bookings, no application-level locking required.


## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes/:id/stations` | All stations with zone and distance |
| GET | `/api/trips` | All trips (route_id query param) |
| GET | `/api/trips/:id/stops` | Timetable stops with can_board flag |
| GET | `/api/trips/:id/availability?origin=&dest=` | All seats with availability and blocking info |
| POST | `/api/trips/:id/bookings` | Create booking (handles concurrency) |
| GET | `/api/trips/:id/bookings` | All bookings for a trip |
| GET | `/api/bookings/:id` | Single booking by ID |
| DELETE | `/api/bookings/:id` | Cancel booking and trigger waitlist promotion |
| POST | `/api/trips/find-or-create` | Create trip on demand for a date/direction |
| GET | `/api/bookings/:id/verify?token=` | Public QR verification (no auth required) |
| POST | `/api/trips/:id/waitlist` | Join waitlist for a leg |
| GET | `/api/trips/:id/waitlist` | List waitlist entries |
| GET | `/api/trips/:id/live` | WebSocket: real-time station departure events |
| POST | `/api/auth/upsert-user` | Upsert user on Google sign-in |
| GET | `/api/users/:id/bookings` | Booking history for a user |
| GET | `/api/admin/trips/:id/summary` | Occupancy and revenue summary |
| GET | `/api/admin/days-off` | List all days off |
| POST | `/api/admin/days-off` | Add a day off |
| DELETE | `/api/admin/days-off/:day` | Remove a day off |
| GET | `/api/admin/days-off/range?from=&to=` | Days off in date range (used by date picker) |


## Extra credit features

### Seat map visualization

The booking flow shows a top-down visual diagram of each coach interior, not a flat numbered list. Each class has its real SLR layout: AFC (1st class) 2+2 in 11 rows (44 seats), SC (2nd class) 2+2 in 12 rows (48 seats), TC (3rd class) 3+3 in 11 rows (66 seats). Occupied seats render in red with a tooltip showing which leg they are reserved for (e.g. "Reserved: Kandy to Hatton"). The three coaches render in class order, 1st at top, 3rd at bottom, matching the physical train layout. Seat widths for 1st and 2nd class are wider than 3rd class, reflecting the real coach proportions.


### Waitlisting for fully booked segments

When no reserved seats are available for a requested leg, passengers can join a FIFO waitlist. On cancellation, the system automatically promotes the oldest waiting entry: it queries current availability and attempts `tryInsertBooking` (the same path as a normal booking, with the same exclusion-constraint safety net). If a concurrent cancellation already filled the seat, it tries the next candidate. Waitlist promotion is transparent, the passenger simply finds their booking confirmed.


### Admin view (occupancy, revenue, days off)

A department-facing admin panel at `/admin` with two sections:

**Occupancy and Revenue:** select a train, direction, and date (including past dates for historical review) and the system finds or creates the trip and shows per-leg occupancy bars, total revenue, and booking counts. Occupancy is computed per atomic leg (adjacent station pair), not for the route as a whole. This is the only granularity that is meaningful for a segment-bookable seat, since the same seat can be occupied on one leg and free on another simultaneously.

**Days Off:** admins can block specific future dates (public holidays, maintenance windows). Blocked dates appear struck-through in the passenger-facing date picker and prevent booking creation via the API.


### Fare logic beyond distance-based pricing

The five-factor hybrid model described above. Key decisions worth highlighting:

- **Zone-based** rather than per-km: more intuitive for passengers, captures the meaningful price steps between geographic regions (lowland to hill country to high plateau to descent).
- **Demand-based:** occupancy of a leg at booking time affects price. Early bookers pay less; popular legs near capacity cost more.
- **Time-based:** booking close to departure costs more. This incentivises advance planning and helps fill seats early.
- **Class-based:** per SLR gazette multipliers (1st class = 3x base, 2nd = 1.8x, 3rd = 1.0x). Class is determined by which coach the seat is in; the passenger picks a seat and the fare follows automatically.


### Real-time conflict handling

The availability endpoint returns all seats (not just available ones), with each seat flagged `available: true/false` and occupied seats annotated with `blocked_origin` and `blocked_dest`. The seat map renders occupied seats in red with a hover tooltip. When a booking attempt loses a race (exclusion violation), the frontend automatically refreshes availability and shows a clear message rather than a generic error.


### Route Rail: interactive station diagram

The origin/destination picker is a horizontal diagram of the actual 49-station route, with stations spaced proportionally by real cumulative distance. The diagram fits the full viewport width with no horizontal scrollbar. For inbound trips (Badulla to Colombo), the diagram reverses so the origin is always on the left. Stations that a particular train does not stop at are shown greyed-out with a tooltip. Stations already departed from are updated in real time on a 30-second interval and disabled with an "already departed" tooltip. Zone transitions are colour-coded across five distinct zones.


### Physical ticket with QR verification

Each booking generates a ticket styled after the real SLR paper ticket format: a dark spine with the booking number printed vertically, two magenta stripes as the SLR visual signature, origin and destination in large display type, a detail grid (train, coach, seat, class, passenger, fare), a simulated barcode strip, and a QR code. The QR encodes a verification URL (`/verify/:id?token=...`). The token is an HMAC-SHA256 of the booking ID and creation timestamp, stored at booking time. The verification page is fully public (no login required), making it usable by ticket inspectors scanning at the platform. Cancelled tickets show a CANCELLED watermark; expired tickets (past destination arrival time) show an EXPIRED watermark.


### Google OAuth with role-based access control

Sign-in creates an account automatically. Admin emails are configured via an environment variable, not hardcoded in the application. Admins and passengers see completely different interfaces and cannot access each other's pages. The role is resolved at sign-in time and cached in the JWT token.


## Challenges

**The zone boundary problem:** with stations as close as 3-9 km apart near zone boundaries, any zone system produces short cross-boundary hops that feel expensive relative to equivalent intra-zone hops. This is a known property of zone-based transit pricing (every real-world metro system has the same issue) and was accepted as a reasonable trade-off rather than papered over with an arbitrary distance cap.

**Station spacing in the Route Rail:** 49 stations, many clustered tightly (Haputale/Diyatalawa/Bandarawela/Kinigama are all within 12 km). A purely distance-proportional layout caused label collisions. The fix: enforce a minimum pixel gap between stations, which distorts the diagram slightly but is consistent with how real railway route diagrams handle this -- they deliberately distort distance for legibility.

**Real-time accuracy vs. real-time infrastructure:** The schedule-based tracking strategy is simple and works without any external dependencies, but Sri Lanka's trains frequently run late, making it inaccurate in practice. The WebSocket strategy addresses this but requires a live GPS feed. Both are fully implemented and the switch between them is a single constant change. This was a deliberate architectural decision: get the integration boundary right first, swap the data source later.

**Docker volume and migrations:** PostgreSQL only runs `docker-entrypoint-initdb.d/` scripts on a fresh (empty) volume. When adding new migrations mid-project, `docker-compose down -v` is required to wipe and reinitialize. Documented clearly in the running instructions above.

**Next.js 16 compatibility:** NextAuth v4 declares a peer dependency on Next.js 12-15. Next.js 16 works correctly in practice but npm rejects the install without `--legacy-peer-deps`. This is handled in the Dockerfile and `.npmrc` so neither the grader nor developers need to think about it.

**Admin seeding race condition:** Pre-seeding admin emails in a SQL migration creates a placeholder row with a synthetic ID. When the admin then signs in with Google, the real Google subject ID conflicts with the email unique constraint. The solution: `UpsertUser` uses `ON CONFLICT (email) DO UPDATE` rather than `ON CONFLICT (id) DO UPDATE`, so the real Google subject ID replaces the placeholder while preserving the `is_admin = TRUE` flag.


## What we would build next

- **Backend JWT verification:** Currently auth is enforced only at the Next.js proxy layer. The Go API trusts all requests. Adding JWT verification middleware to the Go API would close this gap.
- **Payment:** Stripe payment intents, with a `pending` booking status until payment confirms. The exclusion constraint already provides idempotency for seat claims.
- **Push notifications:** Notify passengers when their waitlist entry is promoted to a confirmed booking.
- **Live GPS integration:** Wire the existing WebSocket endpoint to a real GPS data source. The frontend integration code is already written and typed; only the server-side emission logic needs to change.