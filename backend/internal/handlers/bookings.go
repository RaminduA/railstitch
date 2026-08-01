package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"railstitch/internal/db"
	"railstitch/internal/fare"
	"railstitch/internal/models"
)

type stationInfo struct {
	ID         int
	Seq        int
	DistanceKm float64
	RouteID    int
}

func (a *API) getTripRoute(tripID int) (routeID int, err error) {
	err = a.DB.QueryRow(`SELECT route_id FROM trips WHERE id = $1`, tripID).Scan(&routeID)
	return
}

func (a *API) getStation(id int) (stationInfo, error) {
	var s stationInfo
	err := a.DB.QueryRow(`SELECT id, route_id, seq, distance_km FROM stations WHERE id = $1`, id).
		Scan(&s.ID, &s.RouteID, &s.Seq, &s.DistanceKm)
	return s, err
}

// GET /api/trips/{tripID}/availability?origin=1&dest=3&class=reserved
func (a *API) Availability(w http.ResponseWriter, r *http.Request, tripID int) {
	class := r.URL.Query().Get("class")
	if class == "" {
		class = "reserved"
	}
	originID, err1 := strconv.Atoi(r.URL.Query().Get("origin"))
	destID, err2 := strconv.Atoi(r.URL.Query().Get("dest"))
	if err1 != nil || err2 != nil {
		writeErr(w, 400, "origin and dest query params are required station IDs")
		return
	}

	origin, err := a.getStation(originID)
	if err != nil {
		writeErr(w, 400, "unknown origin station")
		return
	}
	dest, err := a.getStation(destID)
	if err != nil {
		writeErr(w, 400, "unknown dest station")
		return
	}
	if origin.RouteID != dest.RouteID {
		writeErr(w, 400, "origin and destination are on different routes")
		return
	}
	if origin.Seq >= dest.Seq {
		writeErr(w, 400, "origin must come before destination along the route")
		return
	}

	distance := dest.DistanceKm - origin.DistanceKm
	quotedFare := fare.Quote(distance, class)

	if class != "reserved" {
		writeJSON(w, 200, map[string]interface{}{
			"class":         "unreserved",
			"fare_estimate": quotedFare,
			"note":          "unreserved coaches are not seat managed. board on a first come first served basis",
			"seats":         []models.SeatAvailability{},
		})
		return
	}

	rows, err := a.DB.Query(`
		SELECT s.id, c.coach_number, s.seat_number
		FROM seats s
		JOIN coaches c ON c.id = s.coach_id
		WHERE c.route_id = $1 AND c.class = 'reserved'
		AND NOT EXISTS (
			SELECT 1 FROM bookings b
			WHERE b.trip_id = $2 AND b.seat_id = s.id AND b.status = 'confirmed'
			AND b.seg && int4range($3, $4)
		)
		ORDER BY c.coach_number, s.seat_number`,
		origin.RouteID, tripID, origin.Seq, dest.Seq)
	if err != nil {
		writeErr(w, 500, "failed to query availability")
		return
	}
	defer rows.Close()

	seats := []models.SeatAvailability{}
	for rows.Next() {
		var sa models.SeatAvailability
		if err := rows.Scan(&sa.SeatID, &sa.CoachNumber, &sa.SeatNumber); err != nil {
			writeErr(w, 500, "failed to scan seat")
			return
		}
		sa.Fare = quotedFare
		seats = append(seats, sa)
	}

	writeJSON(w, 200, map[string]interface{}{
		"class":       "reserved",
		"distance_km": distance,
		"fare":        quotedFare,
		"seats":       seats,
	})
}

// POST /api/trips/{tripID}/bookings
func (a *API) CreateBooking(w http.ResponseWriter, r *http.Request, tripID int) {
	var req models.BookingRequest
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, 400, "invalid request body")
		return
	}
	if req.PassengerName == "" {
		writeErr(w, 400, "passenger_name is required")
		return
	}
	if req.Class == "" {
		req.Class = "reserved"
	}
	if req.Class != "reserved" {
		writeErr(w, 400, "only reserved class seats can be booked through this endpoint. unreserved coaches are not seat managed")
		return
	}

	origin, err := a.getStation(req.OriginStationID)
	if err != nil {
		writeErr(w, 400, "unknown origin station")
		return
	}
	dest, err := a.getStation(req.DestStationID)
	if err != nil {
		writeErr(w, 400, "unknown dest station")
		return
	}
	if origin.RouteID != dest.RouteID || origin.Seq >= dest.Seq {
		writeErr(w, 400, "invalid origin/destination for this route")
		return
	}

	distance := dest.DistanceKm - origin.DistanceKm
	quotedFare := fare.Quote(distance, req.Class)

	var candidateSeatIDs []int
	if req.SeatID != 0 {
		candidateSeatIDs = []int{req.SeatID}
	} else {
		rows, err := a.DB.Query(`
			SELECT s.id FROM seats s
			JOIN coaches c ON c.id = s.coach_id
			WHERE c.route_id = $1 AND c.class = 'reserved'
			AND NOT EXISTS (
				SELECT 1 FROM bookings b
				WHERE b.trip_id = $2 AND b.seat_id = s.id AND b.status = 'confirmed'
				AND b.seg && int4range($3, $4)
			)
			ORDER BY c.coach_number, s.seat_number`,
			origin.RouteID, tripID, origin.Seq, dest.Seq)
		if err != nil {
			writeErr(w, 500, "failed to find candidate seats")
			return
		}
		for rows.Next() {
			var id int
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				writeErr(w, 500, "failed to scan candidate seat")
				return
			}
			candidateSeatIDs = append(candidateSeatIDs, id)
		}
		rows.Close()
	}

	if len(candidateSeatIDs) == 0 {
		writeErr(w, 409, "no seats available for this leg. consider joining the waitlist")
		return
	}

	var booked *models.Booking
	for _, seatID := range candidateSeatIDs {
		b, err := a.tryInsertBooking(tripID, seatID, origin, dest, req.PassengerName, quotedFare)
		if err == nil {
			booked = b
			break
		}
		if db.IsUniqueOrExclusionViolation(err) {
			// Someone else took this exact seat/segment first.
			// Try the next candidate rather than failing the whole request.
			continue
		}
		writeErr(w, 500, "failed to create booking")
		return
	}

	if booked == nil {
		if req.SeatID != 0 {
			writeErr(w, 409, "that seat was just booked by someone else for an overlapping leg. please pick another seat")
		} else {
			writeErr(w, 409, "no seats available for this leg. consider joining the waitlist")
		}
		return
	}

	enriched, err := a.getBookingByID(booked.ID)
	if err != nil {
		writeJSON(w, 201, booked)
		return
	}
	writeJSON(w, 201, enriched)
}

func (a *API) getBookingByID(id int) (*models.Booking, error) {
	var b models.Booking
	err := a.DB.QueryRow(`
		SELECT b.id, b.trip_id, b.seat_id, c.coach_number, s.seat_number,
		       b.origin_station_id, b.dest_station_id, os.name, ds.name,
		       b.passenger_name, b.fare, b.status, b.created_at
		FROM bookings b
		JOIN seats s ON s.id = b.seat_id
		JOIN coaches c ON c.id = s.coach_id
		JOIN stations os ON os.id = b.origin_station_id
		JOIN stations ds ON ds.id = b.dest_station_id
		WHERE b.id = $1`, id,
	).Scan(&b.ID, &b.TripID, &b.SeatID, &b.CoachNumber, &b.SeatNumber,
		&b.OriginStationID, &b.DestStationID, &b.OriginName, &b.DestName,
		&b.PassengerName, &b.Fare, &b.Status, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (a *API) tryInsertBooking(tripID, seatID int, origin, dest stationInfo, passenger string, fareAmt float64) (*models.Booking, error) {
	var b models.Booking
	err := a.DB.QueryRow(`
		INSERT INTO bookings (trip_id, seat_id, origin_station_id, dest_station_id, seg, passenger_name, fare, status)
		VALUES ($1, $2, $3, $4, int4range($5, $6), $7, $8, 'confirmed')
		RETURNING id, trip_id, seat_id, origin_station_id, dest_station_id, passenger_name, fare, status, created_at`,
		tripID, seatID, origin.ID, dest.ID, origin.Seq, dest.Seq, passenger, fareAmt,
	).Scan(&b.ID, &b.TripID, &b.SeatID, &b.OriginStationID, &b.DestStationID, &b.PassengerName, &b.Fare, &b.Status, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// GET /api/trips/{tripID}/bookings
func (a *API) ListBookings(w http.ResponseWriter, r *http.Request, tripID int) {
	rows, err := a.DB.Query(`
		SELECT b.id, b.trip_id, b.seat_id, c.coach_number, s.seat_number,
		       b.origin_station_id, b.dest_station_id, os.name, ds.name,
		       b.passenger_name, b.fare, b.status, b.created_at
		FROM bookings b
		JOIN seats s ON s.id = b.seat_id
		JOIN coaches c ON c.id = s.coach_id
		JOIN stations os ON os.id = b.origin_station_id
		JOIN stations ds ON ds.id = b.dest_station_id
		WHERE b.trip_id = $1
		ORDER BY c.coach_number, s.seat_number, b.created_at`, tripID)
	if err != nil {
		writeErr(w, 500, "failed to load bookings")
		return
	}
	defer rows.Close()

	out := []models.Booking{}
	for rows.Next() {
		var b models.Booking
		if err := rows.Scan(&b.ID, &b.TripID, &b.SeatID, &b.CoachNumber, &b.SeatNumber,
			&b.OriginStationID, &b.DestStationID, &b.OriginName, &b.DestName,
			&b.PassengerName, &b.Fare, &b.Status, &b.CreatedAt); err != nil {
			writeErr(w, 500, "failed to scan booking")
			return
		}
		out = append(out, b)
	}
	writeJSON(w, 200, out)
}

// DELETE /api/bookings/{id}
func (a *API) CancelBooking(w http.ResponseWriter, r *http.Request, bookingID int) {
	var tripID int
	err := a.DB.QueryRow(`
		UPDATE bookings SET status = 'cancelled'
		WHERE id = $1 AND status = 'confirmed'
		RETURNING trip_id`, bookingID).Scan(&tripID)
	if errors.Is(err, sql.ErrNoRows) {
		writeErr(w, 404, "booking not found or already cancelled")
		return
	}
	if err != nil {
		writeErr(w, 500, "failed to cancel booking")
		return
	}

	promoted, _ := a.tryPromoteWaitlist(tripID)
	writeJSON(w, 200, map[string]interface{}{
		"cancelled":         true,
		"promoted_waitlist": promoted,
	})
}
