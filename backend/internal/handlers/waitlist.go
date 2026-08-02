package handlers

import (
	"net/http"

	"railstitch/internal/db"
	"railstitch/internal/fare"
	"railstitch/internal/models"
)

// POST /api/trips/{tripID}/waitlist
func (a *API) CreateWaitlistEntry(w http.ResponseWriter, r *http.Request, tripID int) {
	var req models.WaitlistRequest
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

	var entry models.WaitlistEntry
	err = a.DB.QueryRow(`
		INSERT INTO waitlist_entries (trip_id, origin_station_id, dest_station_id, class, passenger_name, status)
		VALUES ($1, $2, $3, $4, $5, 'waiting')
		RETURNING id, trip_id, origin_station_id, dest_station_id, class, passenger_name, status, created_at`,
		tripID, origin.ID, dest.ID, req.Class, req.PassengerName,
	).Scan(&entry.ID, &entry.TripID, &entry.OriginStationID, &entry.DestStationID, &entry.Class, &entry.PassengerName, &entry.Status, &entry.CreatedAt)
	if err != nil {
		writeErr(w, 500, "failed to create waitlist entry")
		return
	}

	writeJSON(w, 201, entry)
}

// GET /api/trips/{tripID}/waitlist
func (a *API) ListWaitlist(w http.ResponseWriter, r *http.Request, tripID int) {
	rows, err := a.DB.Query(`
		SELECT id, trip_id, origin_station_id, dest_station_id, class, passenger_name, status, created_at
		FROM waitlist_entries WHERE trip_id = $1 ORDER BY created_at`, tripID)
	if err != nil {
		writeErr(w, 500, "failed to load waitlist")
		return
	}
	defer rows.Close()

	out := []models.WaitlistEntry{}
	for rows.Next() {
		var e models.WaitlistEntry
		if err := rows.Scan(&e.ID, &e.TripID, &e.OriginStationID, &e.DestStationID, &e.Class, &e.PassengerName, &e.Status, &e.CreatedAt); err != nil {
			writeErr(w, 500, "failed to scan waitlist entry")
			return
		}
		out = append(out, e)
	}
	writeJSON(w, 200, out)
}

func (a *API) tryPromoteWaitlist(tripID int) (bool, error) {
	rows, err := a.DB.Query(`
		SELECT id, origin_station_id, dest_station_id, class, passenger_name
		FROM waitlist_entries
		WHERE trip_id = $1 AND status = 'waiting'
		ORDER BY created_at`, tripID)
	if err != nil {
		return false, err
	}

	type pending struct {
		id               int
		originID, destID int
		class, passenger string
	}
	var entries []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.originID, &p.destID, &p.class, &p.passenger); err != nil {
			rows.Close()
			return false, err
		}
		entries = append(entries, p)
	}
	rows.Close()

	anyPromoted := false
	for _, p := range entries {
		if p.class != "reserved" {
			continue
		}
		origin, err := a.getStation(p.originID)
		if err != nil {
			continue
		}
		dest, err := a.getStation(p.destID)
		if err != nil {
			continue
		}

		seatRows, err := a.DB.Query(`
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
			continue
		}
		var candidates []int
		for seatRows.Next() {
			var id int
			if err := seatRows.Scan(&id); err == nil {
				candidates = append(candidates, id)
			}
		}
		seatRows.Close()

		if len(candidates) == 0 {
			continue
		}

		distance := dest.DistanceKm - origin.DistanceKm
		quotedFare := fare.Quote(distance, "reserved", origin.Seq, dest.Seq)

		for _, seatID := range candidates {
			booking, err := a.tryInsertBooking(tripID, seatID, origin, dest, p.passenger, quotedFare)
			if err == nil {
				_, _ = a.DB.Exec(`
					UPDATE waitlist_entries SET status = 'promoted', promoted_booking_id = $1
					WHERE id = $2`, booking.ID, p.id)
				anyPromoted = true
				break
			}
			if db.IsUniqueOrExclusionViolation(err) {
				continue
			}
			break
		}
	}

	return anyPromoted, nil
}
