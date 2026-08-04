package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"time"
)

// POST /api/trips/find-or-create
// Called when a user clicks "Proceed" on the train page after picking
// a date and direction. Creates the trip if it doesn't exist yet, or
// returns the existing one. The UNIQUE constraint on (route_id, name,
// service_date, direction) makes this race-safe: concurrent requests
// for the same trip both succeed, returning the same row.
func (a *API) FindOrCreateTrip(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TrainName   string `json:"train_name"`
		ServiceDate string `json:"service_date"` // "YYYY-MM-DD"
		Direction   string `json:"direction"`    // "outbound" | "inbound"
	}
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, 400, "invalid request body")
		return
	}
	if req.TrainName == "" || req.ServiceDate == "" || req.Direction == "" {
		writeErr(w, 400, "train_name, service_date and direction are required")
		return
	}
	if req.Direction != "outbound" && req.Direction != "inbound" {
		writeErr(w, 400, "direction must be 'outbound' or 'inbound'")
		return
	}

	// Validate date format and that it's not in the past
	svcDate, err := time.Parse("2006-01-02", req.ServiceDate)
	if err != nil {
		writeErr(w, 400, "service_date must be YYYY-MM-DD")
		return
	}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	if svcDate.Before(today) {
		writeErr(w, 400, "service_date must be today or in the future")
		return
	}

	// Check if the date is a day off
	var dayOffID int
	err = a.DB.QueryRow(
		`SELECT id FROM days_off WHERE day = $1`, req.ServiceDate,
	).Scan(&dayOffID)
	if err == nil {
		writeErr(w, 409, "no service on this date")
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		writeErr(w, 500, "failed to check days off")
		return
	}

	// Look up route_id (hardcoded to 1 for now; extendable when more routes are added)
	const routeID = 1

	// Try to find existing trip
	var tripID int
	err = a.DB.QueryRow(`
		SELECT id FROM trips
		WHERE route_id = $1 AND name = $2 AND service_date = $3 AND direction = $4`,
		routeID, req.TrainName, req.ServiceDate, req.Direction,
	).Scan(&tripID)

	if err == nil {
		// Already exists — return it
		trips, _ := a.loadTrip(tripID)
		writeJSON(w, 200, trips)
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		writeErr(w, 500, "failed to look up trip")
		return
	}

	// Create the trip. On a unique violation (concurrent request), fall back
	// to SELECT.
	err = a.DB.QueryRow(`
		INSERT INTO trips (route_id, name, service_date, direction, overnight_outbound, overnight_inbound)
		VALUES ($1, $2, $3, $4, false, false)
		ON CONFLICT (route_id, name, service_date, direction) DO NOTHING
		RETURNING id`,
		routeID, req.TrainName, req.ServiceDate, req.Direction,
	).Scan(&tripID)

	if errors.Is(err, sql.ErrNoRows) {
		// ON CONFLICT hit — fetch the existing row
		if err2 := a.DB.QueryRow(`
			SELECT id FROM trips
			WHERE route_id = $1 AND name = $2 AND service_date = $3 AND direction = $4`,
			routeID, req.TrainName, req.ServiceDate, req.Direction,
		).Scan(&tripID); err2 != nil {
			writeErr(w, 500, "failed to fetch existing trip")
			return
		}
	} else if err != nil {
		writeErr(w, 500, "failed to create trip")
		return
	}

	// For a newly created trip, seed trip_stops from the canonical timetable.
	// Find any existing trip with the same name and direction to copy stops from.
	var templateTripID int
	err = a.DB.QueryRow(`
		SELECT id FROM trips
		WHERE name = $1 AND direction = $2 AND id != $3
		ORDER BY service_date LIMIT 1`,
		req.TrainName, req.Direction, tripID,
	).Scan(&templateTripID)

	if err == nil && templateTripID > 0 {
		_, _ = a.DB.Exec(`
			INSERT INTO trip_stops (trip_id, station_id, seq_in_trip, arrival_time, departure_time)
			SELECT $1, station_id, seq_in_trip, arrival_time, departure_time
			FROM trip_stops WHERE trip_id = $2
			ON CONFLICT DO NOTHING`,
			tripID, templateTripID,
		)
	}

	trip, _ := a.loadTrip(tripID)
	writeJSON(w, 201, trip)
}

func (a *API) loadTrip(id int) (interface{}, error) {
	var t struct {
		ID                int    `json:"id"`
		RouteID           int    `json:"route_id"`
		Name              string `json:"name"`
		ServiceDate       string `json:"service_date"`
		Direction         string `json:"direction"`
		OvernightOutbound bool   `json:"overnight_outbound"`
		OvernightInbound  bool   `json:"overnight_inbound"`
	}
	err := a.DB.QueryRow(`
		SELECT id, route_id, name, service_date::text, direction,
		       overnight_outbound, overnight_inbound
		FROM trips WHERE id = $1`, id).
		Scan(&t.ID, &t.RouteID, &t.Name, &t.ServiceDate, &t.Direction,
			&t.OvernightOutbound, &t.OvernightInbound)
	return t, err
}

// GET /api/admin/days-off
func (a *API) ListDaysOff(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(
		`SELECT id, day::text, reason, created_at FROM days_off ORDER BY day`)
	if err != nil {
		writeErr(w, 500, "failed to load days off")
		return
	}
	defer rows.Close()

	type dayOff struct {
		ID        int       `json:"id"`
		Day       string    `json:"day"`
		Reason    string    `json:"reason"`
		CreatedAt time.Time `json:"created_at"`
	}
	out := []dayOff{}
	for rows.Next() {
		var d dayOff
		if err := rows.Scan(&d.ID, &d.Day, &d.Reason, &d.CreatedAt); err != nil {
			writeErr(w, 500, "failed to scan day off")
			return
		}
		out = append(out, d)
	}
	writeJSON(w, 200, out)
}

// POST /api/admin/days-off
func (a *API) AddDayOff(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Day    string `json:"day"`    // "YYYY-MM-DD"
		Reason string `json:"reason"` // optional description
	}
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, 400, "invalid request body")
		return
	}
	if _, err := time.Parse("2006-01-02", req.Day); err != nil {
		writeErr(w, 400, "day must be YYYY-MM-DD")
		return
	}

	type dayOff struct {
		ID        int       `json:"id"`
		Day       string    `json:"day"`
		Reason    string    `json:"reason"`
		CreatedAt time.Time `json:"created_at"`
	}
	var d dayOff
	err := a.DB.QueryRow(`
		INSERT INTO days_off (day, reason)
		VALUES ($1, $2)
		ON CONFLICT (day) DO UPDATE SET reason = EXCLUDED.reason
		RETURNING id, day::text, reason, created_at`,
		req.Day, req.Reason,
	).Scan(&d.ID, &d.Day, &d.Reason, &d.CreatedAt)
	if err != nil {
		writeErr(w, 500, "failed to add day off")
		return
	}
	writeJSON(w, 201, d)
}

// DELETE /api/admin/days-off/{day}
func (a *API) RemoveDayOff(w http.ResponseWriter, r *http.Request, day string) {
	if _, err := time.Parse("2006-01-02", day); err != nil {
		writeErr(w, 400, "day must be YYYY-MM-DD")
		return
	}
	result, err := a.DB.Exec(`DELETE FROM days_off WHERE day = $1`, day)
	if err != nil {
		writeErr(w, 500, "failed to remove day off")
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeErr(w, 404, "day off not found")
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

// GET /api/admin/days-off/range?from=YYYY-MM-DD&to=YYYY-MM-DD
// Used by the date picker to know which dates to block.
func (a *API) DaysOffInRange(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from == "" || to == "" {
		writeErr(w, 400, "from and to query params required")
		return
	}
	rows, err := a.DB.Query(
		`SELECT day::text FROM days_off WHERE day BETWEEN $1 AND $2 ORDER BY day`,
		from, to)
	if err != nil {
		writeErr(w, 500, "failed to query days off")
		return
	}
	defer rows.Close()
	days := []string{}
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err == nil {
			days = append(days, d)
		}
	}
	writeJSON(w, 200, days)
}
