package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"railstitch/internal/models"
)

type API struct {
	DB *sql.DB
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// GET /api/routes/{routeID}/stations
func (a *API) ListStations(w http.ResponseWriter, r *http.Request, routeID int) {
	rows, err := a.DB.Query(`
		SELECT id, route_id, name, seq, distance_km, zone
		FROM stations WHERE route_id = $1 ORDER BY seq`, routeID)
	if err != nil {
		writeErr(w, 500, "failed to load stations")
		return
	}
	defer rows.Close()

	out := []models.Station{}
	for rows.Next() {
		var s models.Station
		if err := rows.Scan(&s.ID, &s.RouteID, &s.Name, &s.Seq, &s.DistanceKm, &s.Zone); err != nil {
			writeErr(w, 500, "failed to scan station")
			return
		}
		out = append(out, s)
	}
	writeJSON(w, 200, out)
}

// GET /api/trips?route_id=1
func (a *API) ListTrips(w http.ResponseWriter, r *http.Request) {
	routeID := r.URL.Query().Get("route_id")
	if routeID == "" {
		routeID = "1"
	}
	rows, err := a.DB.Query(`
		SELECT id, route_id, name, service_date::text, direction,
		       overnight_outbound, overnight_inbound
		FROM trips WHERE route_id = $1 ORDER BY service_date, direction`, routeID)
	if err != nil {
		writeErr(w, 500, "failed to load trips")
		return
	}
	defer rows.Close()

	out := []models.Trip{}
	for rows.Next() {
		var t models.Trip
		if err := rows.Scan(&t.ID, &t.RouteID, &t.Name, &t.ServiceDate,
			&t.Direction, &t.OvernightOutbound, &t.OvernightInbound); err != nil {
			writeErr(w, 500, "failed to scan trip")
			return
		}
		out = append(out, t)
	}
	writeJSON(w, 200, out)
}

// GET /api/trips/{tripID}/stops
func (a *API) ListTripStops(w http.ResponseWriter, r *http.Request, tripID int) {
	// Fetch the trip to get service_date and overnight flags
	var serviceDate string
	var direction string
	var overnightOut, overnightIn bool
	err := a.DB.QueryRow(`
		SELECT service_date::text, direction, overnight_outbound, overnight_inbound
		FROM trips WHERE id = $1`, tripID).
		Scan(&serviceDate, &direction, &overnightOut, &overnightIn)
	if err != nil {
		writeErr(w, 404, "trip not found")
		return
	}

	svcDate, _ := time.Parse("2006-01-02", serviceDate)
	now := time.Now().UTC()

	rows, err := a.DB.Query(`
		SELECT ts.id, ts.trip_id, ts.station_id, s.name, s.seq, ts.seq_in_trip,
		       s.zone, s.distance_km,
		       to_char(ts.arrival_time, 'HH24:MI'),
		       to_char(ts.departure_time, 'HH24:MI')
		FROM trip_stops ts
		JOIN stations s ON s.id = ts.station_id
		WHERE ts.trip_id = $1
		ORDER BY ts.seq_in_trip`, tripID)
	if err != nil {
		writeErr(w, 500, "failed to load trip stops")
		return
	}
	defer rows.Close()

	var stops []models.TripStop
	for rows.Next() {
		var ts models.TripStop
		var arr, dep *string
		if err := rows.Scan(&ts.ID, &ts.TripID, &ts.StationID, &ts.StationName,
			&ts.Seq, &ts.SeqInTrip, &ts.Zone, &ts.DistanceKm, &arr, &dep); err != nil {
			writeErr(w, 500, "failed to scan stop")
			return
		}
		ts.ArrivalTime = arr
		ts.DepartureTime = dep
		ts.CanBoard = canBoard(dep, svcDate, now, overnightOut && direction == "outbound")
		stops = append(stops, ts)
	}
	writeJSON(w, 200, stops)
}

func canBoard(dep *string, svcDate time.Time, now time.Time, overnight bool) bool {
	if dep == nil {
		return false
	}

	h, m := 0, 0
	parseHHMM(*dep, &h, &m)
	depTime := time.Date(svcDate.Year(), svcDate.Month(), svcDate.Day(),
		h, m, 0, 0, time.UTC)
	if overnight {
		if h < 5 {
			depTime = depTime.AddDate(0, 0, 1)
		}
	}
	return now.Before(depTime)
}

func parseHHMM(s string, h, m *int) {
	if len(s) >= 5 {
		fmt.Sscanf(s, "%d:%d", h, m)
	}
}
