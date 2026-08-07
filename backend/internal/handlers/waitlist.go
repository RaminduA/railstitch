package handlers

import (
	"net/http"

	"railstitch/internal/db"
	"railstitch/internal/fare"
	"railstitch/internal/models"
	"time"
)

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
		req.Class = "third"
	}
	if req.PassengerType == "" {
		req.PassengerType = "adult"
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

	var entry models.WaitlistEntry
	err = a.DB.QueryRow(`
		INSERT INTO waitlist_entries
		  (trip_id, origin_station_id, dest_station_id, class, passenger_name, passenger_type, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'waiting')
		RETURNING id, trip_id, origin_station_id, dest_station_id, class,
		          passenger_name, passenger_type, status, created_at`,
		tripID, origin.ID, dest.ID, req.Class, req.PassengerName, req.PassengerType,
	).Scan(&entry.ID, &entry.TripID, &entry.OriginStationID, &entry.DestStationID,
		&entry.Class, &entry.PassengerName, &entry.PassengerType, &entry.Status, &entry.CreatedAt)
	if err != nil {
		writeErr(w, 500, "failed to create waitlist entry")
		return
	}
	writeJSON(w, 201, entry)
}

func (a *API) ListWaitlist(w http.ResponseWriter, r *http.Request, tripID int) {
	rows, err := a.DB.Query(`
		SELECT id, trip_id, origin_station_id, dest_station_id, class,
		       passenger_name, passenger_type, status, created_at
		FROM waitlist_entries WHERE trip_id = $1 ORDER BY created_at`, tripID)
	if err != nil {
		writeErr(w, 500, "failed to load waitlist")
		return
	}
	defer rows.Close()

	out := []models.WaitlistEntry{}
	for rows.Next() {
		var e models.WaitlistEntry
		if err := rows.Scan(&e.ID, &e.TripID, &e.OriginStationID, &e.DestStationID,
			&e.Class, &e.PassengerName, &e.PassengerType, &e.Status, &e.CreatedAt); err != nil {
			writeErr(w, 500, "failed to scan waitlist entry")
			return
		}
		out = append(out, e)
	}
	writeJSON(w, 200, out)
}

func (a *API) tryPromoteWaitlist(tripID int) (bool, error) {
	var serviceDate string
	_ = a.DB.QueryRow(`SELECT service_date::text FROM trips WHERE id = $1`, tripID).Scan(&serviceDate)
	svcDate, _ := time.Parse("2006-01-02", serviceDate)
	days := fare.DaysUntil(svcDate)

	rows, err := a.DB.Query(`
		SELECT id, origin_station_id, dest_station_id, class, passenger_name, passenger_type
		FROM waitlist_entries
		WHERE trip_id = $1 AND status = 'waiting'
		ORDER BY created_at`, tripID)
	if err != nil {
		return false, err
	}
	type pending struct {
		id                      int
		originID, destID        int
		class, passenger, pType string
	}
	var entries []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.originID, &p.destID, &p.class, &p.passenger, &p.pType); err != nil {
			rows.Close()
			return false, err
		}
		entries = append(entries, p)
	}
	rows.Close()

	anyPromoted := false
	for _, p := range entries {
		origin, err := a.getStation(p.originID)
		if err != nil {
			continue
		}
		dest, err := a.getStation(p.destID)
		if err != nil {
			continue
		}
		minSeq, maxSeq := origin.Seq, dest.Seq
		if minSeq > maxSeq {
			minSeq, maxSeq = maxSeq, minSeq
		}
		seatRows, err := a.DB.Query(`
			SELECT s.id FROM seats s
			JOIN coaches c ON c.id = s.coach_id
			WHERE c.route_id = $1 AND c.class = $2
			AND NOT EXISTS (
				SELECT 1 FROM bookings b
				WHERE b.trip_id = $3 AND b.seat_id = s.id AND b.status = 'confirmed'
				AND b.seg && int4range($4, $5)
			)
			ORDER BY s.seat_number LIMIT 1`,
			origin.RouteID, p.class, tripID, minSeq, maxSeq)
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

		var occupancyPct float64
		var occ, total int
		_ = a.DB.QueryRow(`
			SELECT
			  (SELECT COUNT(DISTINCT seat_id) FROM bookings
			   WHERE trip_id = $1 AND status = 'confirmed'
			   AND seg && int4range($2, $3)),
			  (SELECT COUNT(*) FROM seats s JOIN coaches c ON c.id = s.coach_id
			   JOIN trips t ON t.route_id = c.route_id
			   WHERE t.id = $1 AND c.class != 'unreserved')`,
			tripID, minSeq, maxSeq).Scan(&occ, &total)
		if total > 0 {
			occupancyPct = float64(occ) / float64(total) * 100
		}
		quotedFare := fare.QuoteWithoutDB(fare.Input{
			OriginZone:         origin.Zone,
			DestZone:           dest.Zone,
			CoachClass:         p.class,
			OccupancyPct:       occupancyPct,
			DaysUntilDeparture: days,
			PassengerType:      p.pType,
		})

		booking, err := a.tryInsertBooking(tripID, candidates[0], origin, dest, p.passenger, p.pType, quotedFare, "")
		if err == nil {
			_, _ = a.DB.Exec(`
				UPDATE waitlist_entries SET status = 'promoted', promoted_booking_id = $1
				WHERE id = $2`, booking.ID, p.id)
			anyPromoted = true
		} else if !db.IsUniqueOrExclusionViolation(err) {
			break
		}
	}
	return anyPromoted, nil
}
