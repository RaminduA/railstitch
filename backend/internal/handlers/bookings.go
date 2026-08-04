package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"time"

	"railstitch/internal/db"
	"railstitch/internal/fare"
	"railstitch/internal/models"
)

type stationInfo struct {
	ID         int
	Seq        int
	Zone       int
	DistanceKm float64
	RouteID    int
}

func (a *API) getTripFull(tripID int) (routeID int, serviceDate string, direction string, err error) {
	err = a.DB.QueryRow(
		`SELECT route_id, service_date::text, direction FROM trips WHERE id = $1`, tripID,
	).Scan(&routeID, &serviceDate, &direction)
	return
}

func (a *API) getStation(id int) (stationInfo, error) {
	var s stationInfo
	err := a.DB.QueryRow(
		`SELECT id, route_id, seq, zone, distance_km FROM stations WHERE id = $1`, id,
	).Scan(&s.ID, &s.RouteID, &s.Seq, &s.Zone, &s.DistanceKm)
	return s, err
}

func (a *API) getCoachClass(seatID int) (string, error) {
	var class string
	err := a.DB.QueryRow(
		`SELECT c.class FROM coaches c JOIN seats s ON s.coach_id = c.id WHERE s.id = $1`, seatID,
	).Scan(&class)
	return class, err
}

func (a *API) computeFare(tripID int, origin, dest stationInfo, coachClass, passengerType, serviceDate string) int {
	svcDate, _ := time.Parse("2006-01-02", serviceDate)
	days := fare.DaysUntil(svcDate)

	minSeq, maxSeq := origin.Seq, dest.Seq
	if minSeq > maxSeq {
		minSeq, maxSeq = maxSeq, minSeq
	}
	var occupied, total int
	_ = a.DB.QueryRow(`
		SELECT
			(SELECT COUNT(DISTINCT seat_id) FROM bookings
			 WHERE trip_id = $1 AND status = 'confirmed'
			 AND seg && int4range($2, $3)),
			(SELECT COUNT(*) FROM seats s
			 JOIN coaches c ON c.id = s.coach_id
			 JOIN trips t ON t.route_id = c.route_id
			 WHERE t.id = $1 AND c.class != 'unreserved')`,
		tripID, minSeq, maxSeq,
	).Scan(&occupied, &total)

	occupancyPct := 0.0
	if total > 0 {
		occupancyPct = float64(occupied) / float64(total) * 100
	}

	return fare.QuoteWithoutDB(fare.Input{
		OriginZone:         origin.Zone,
		DestZone:           dest.Zone,
		CoachClass:         coachClass,
		OccupancyPct:       occupancyPct,
		DaysUntilDeparture: days,
		PassengerType:      passengerType,
	})
}

// GET /api/trips/{tripID}/availability
func (a *API) Availability(w http.ResponseWriter, r *http.Request, tripID int) {
	originID, err1 := strconv.Atoi(r.URL.Query().Get("origin"))
	destID, err2 := strconv.Atoi(r.URL.Query().Get("dest"))
	if err1 != nil || err2 != nil {
		writeErr(w, 400, "origin and dest query params are required station IDs")
		return
	}

	_, serviceDate, _, err := a.getTripFull(tripID)
	if err != nil {
		writeErr(w, 404, "trip not found")
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
	if origin.Seq == dest.Seq {
		writeErr(w, 400, "origin and destination must differ")
		return
	}

	minSeq, maxSeq := origin.Seq, dest.Seq
	if minSeq > maxSeq {
		minSeq, maxSeq = maxSeq, minSeq
	}

	// Fetch all reserved seats with their booking status for this leg
	rows, err := a.DB.Query(`
		SELECT s.id, c.id, c.coach_number, c.class, c.display_order, s.seat_number,
		       NOT EXISTS (
		           SELECT 1 FROM bookings b
		           WHERE b.trip_id = $1 AND b.seat_id = s.id
		           AND b.status = 'confirmed'
		           AND b.seg && int4range($2, $3)
		       ) AS available
		FROM seats s
		JOIN coaches c ON c.id = s.coach_id
		WHERE c.route_id = $4 AND c.class != 'unreserved'
		ORDER BY c.display_order, s.seat_number`,
		tripID, minSeq, maxSeq, origin.RouteID)
	if err != nil {
		writeErr(w, 500, "failed to query seats")
		return
	}
	defer rows.Close()

	// Group seats by coach, compute per-coach fare for an adult
	type coachKey struct {
		id           int
		coachNumber  string
		class        string
		displayOrder int
	}
	coachMap := map[int]*models.CoachWithSeats{}
	coachOrder := []int{}

	for rows.Next() {
		var seatID, coachID int
		var coachNumber, class string
		var displayOrder, seatNumber int
		var available bool
		if err := rows.Scan(&seatID, &coachID, &coachNumber, &class,
			&displayOrder, &seatNumber, &available); err != nil {
			writeErr(w, 500, "failed to scan seat")
			return
		}
		if _, exists := coachMap[coachID]; !exists {
			fareAmt := a.computeFare(tripID, origin, dest, class, "adult", serviceDate)
			coachMap[coachID] = &models.CoachWithSeats{
				CoachID:      coachID,
				CoachNumber:  coachNumber,
				Class:        class,
				DisplayOrder: displayOrder,
				FareAdult:    fareAmt,
				Seats:        []models.SeatWithStatus{},
			}
			coachOrder = append(coachOrder, coachID)
		}
		coachMap[coachID].Seats = append(coachMap[coachID].Seats, models.SeatWithStatus{
			SeatID:      seatID,
			CoachNumber: coachNumber,
			CoachClass:  class,
			SeatNumber:  seatNumber,
			Available:   available,
		})
	}

	coaches := make([]models.CoachWithSeats, 0, len(coachOrder))
	for _, id := range coachOrder {
		coaches = append(coaches, *coachMap[id])
	}

	writeJSON(w, 200, models.AvailabilityResponse{
		TripID:   tripID,
		OriginID: originID,
		DestID:   destID,
		Coaches:  coaches,
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
	if req.PassengerType == "" {
		req.PassengerType = "adult"
	}

	_, serviceDate, _, err := a.getTripFull(tripID)
	if err != nil {
		writeErr(w, 404, "trip not found")
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
	if origin.RouteID != dest.RouteID || origin.Seq == dest.Seq {
		writeErr(w, 400, "invalid origin/destination for this route")
		return
	}

	// Determine coach class from the specific seat requested
	coachClass := req.Class
	if req.SeatID != 0 {
		cc, err := a.getCoachClass(req.SeatID)
		if err != nil {
			writeErr(w, 400, "unknown seat")
			return
		}
		coachClass = cc
	}
	if coachClass == "" {
		coachClass = "third"
	}

	quotedFare := a.computeFare(tripID, origin, dest, coachClass, req.PassengerType, serviceDate)

	var candidateSeatIDs []int
	if req.SeatID != 0 {
		candidateSeatIDs = []int{req.SeatID}
	} else {
		minSeq, maxSeq := origin.Seq, dest.Seq
		if minSeq > maxSeq {
			minSeq, maxSeq = maxSeq, minSeq
		}
		classFilter := coachClass
		rows, err := a.DB.Query(`
			SELECT s.id FROM seats s
			JOIN coaches c ON c.id = s.coach_id
			WHERE c.route_id = $1 AND c.class = $2
			AND NOT EXISTS (
				SELECT 1 FROM bookings b
				WHERE b.trip_id = $3 AND b.seat_id = s.id AND b.status = 'confirmed'
				AND b.seg && int4range($4, $5)
			)
			ORDER BY s.seat_number`,
			origin.RouteID, classFilter, tripID, minSeq, maxSeq)
		if err != nil {
			writeErr(w, 500, "failed to find candidate seats")
			return
		}
		for rows.Next() {
			var id int
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				writeErr(w, 500, "failed to scan seat")
				return
			}
			candidateSeatIDs = append(candidateSeatIDs, id)
		}
		rows.Close()
	}

	if len(candidateSeatIDs) == 0 {
		writeErr(w, 409, "no seats available for this leg; consider joining the waitlist")
		return
	}

	var booked *models.Booking
	for _, seatID := range candidateSeatIDs {
		b, err := a.tryInsertBooking(tripID, seatID, origin, dest, req.PassengerName, req.PassengerType, quotedFare)
		if err == nil {
			booked = b
			break
		}
		if db.IsUniqueOrExclusionViolation(err) {
			continue
		}
		writeErr(w, 500, "failed to create booking")
		return
	}

	if booked == nil {
		if req.SeatID != 0 {
			writeErr(w, 409, "that seat was just booked by someone else; please pick another")
		} else {
			writeErr(w, 409, "no seats available for this leg; consider joining the waitlist")
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

func (a *API) tryInsertBooking(tripID, seatID int, origin, dest stationInfo,
	passengerName, passengerType string, fareAmt int) (*models.Booking, error) {

	minSeq, maxSeq := origin.Seq, dest.Seq
	if minSeq > maxSeq {
		minSeq, maxSeq = maxSeq, minSeq
	}
	var b models.Booking
	err := a.DB.QueryRow(`
		INSERT INTO bookings
		  (trip_id, seat_id, origin_station_id, dest_station_id, seg, passenger_name, passenger_type, fare, status)
		VALUES ($1, $2, $3, $4, int4range($5, $6), $7, $8, $9, 'confirmed')
		RETURNING id, trip_id, seat_id, origin_station_id, dest_station_id,
		          passenger_name, passenger_type, fare, status, created_at`,
		tripID, seatID, origin.ID, dest.ID, minSeq, maxSeq, passengerName, passengerType, fareAmt,
	).Scan(&b.ID, &b.TripID, &b.SeatID, &b.OriginStationID, &b.DestStationID,
		&b.PassengerName, &b.PassengerType, &b.Fare, &b.Status, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (a *API) getBookingByID(id int) (*models.Booking, error) {
	var b models.Booking
	err := a.DB.QueryRow(`
		SELECT b.id, b.trip_id, b.seat_id, c.coach_number, c.class, s.seat_number,
		       b.origin_station_id, b.dest_station_id, os.name, ds.name,
		       b.passenger_name, b.passenger_type, b.fare, b.status, b.created_at
		FROM bookings b
		JOIN seats s      ON s.id = b.seat_id
		JOIN coaches c    ON c.id = s.coach_id
		JOIN stations os  ON os.id = b.origin_station_id
		JOIN stations ds  ON ds.id = b.dest_station_id
		WHERE b.id = $1`, id,
	).Scan(&b.ID, &b.TripID, &b.SeatID, &b.CoachNumber, &b.CoachClass, &b.SeatNumber,
		&b.OriginStationID, &b.DestStationID, &b.OriginName, &b.DestName,
		&b.PassengerName, &b.PassengerType, &b.Fare, &b.Status, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// GET /api/trips/{tripID}/bookings
func (a *API) ListBookings(w http.ResponseWriter, r *http.Request, tripID int) {
	rows, err := a.DB.Query(`
		SELECT b.id, b.trip_id, b.seat_id, c.coach_number, c.class, s.seat_number,
		       b.origin_station_id, b.dest_station_id, os.name, ds.name,
		       b.passenger_name, b.passenger_type, b.fare, b.status, b.created_at
		FROM bookings b
		JOIN seats s      ON s.id = b.seat_id
		JOIN coaches c    ON c.id = s.coach_id
		JOIN stations os  ON os.id = b.origin_station_id
		JOIN stations ds  ON ds.id = b.dest_station_id
		WHERE b.trip_id = $1
		ORDER BY c.display_order, s.seat_number, b.created_at`, tripID)
	if err != nil {
		writeErr(w, 500, "failed to load bookings")
		return
	}
	defer rows.Close()

	out := []models.Booking{}
	for rows.Next() {
		var b models.Booking
		if err := rows.Scan(&b.ID, &b.TripID, &b.SeatID, &b.CoachNumber, &b.CoachClass, &b.SeatNumber,
			&b.OriginStationID, &b.DestStationID, &b.OriginName, &b.DestName,
			&b.PassengerName, &b.PassengerType, &b.Fare, &b.Status, &b.CreatedAt); err != nil {
			writeErr(w, 500, "failed to scan booking")
			return
		}
		out = append(out, b)
	}
	writeJSON(w, 200, out)
}

// GET /api/bookings/{id}
func (a *API) GetBooking(w http.ResponseWriter, r *http.Request, bookingID int) {
	b, err := a.getBookingByID(bookingID)
	if errors.Is(err, sql.ErrNoRows) {
		writeErr(w, 404, "booking not found")
		return
	}
	if err != nil {
		writeErr(w, 500, "failed to load booking")
		return
	}
	writeJSON(w, 200, b)
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
