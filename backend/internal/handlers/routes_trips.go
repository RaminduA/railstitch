package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

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
		SELECT id, route_id, name, seq, distance_km
		FROM stations WHERE route_id = $1 ORDER BY seq`, routeID)
	if err != nil {
		writeErr(w, 500, "failed to load stations")
		return
	}
	defer rows.Close()

	out := []models.Station{}
	for rows.Next() {
		var s models.Station
		if err := rows.Scan(&s.ID, &s.RouteID, &s.Name, &s.Seq, &s.DistanceKm); err != nil {
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
		SELECT id, route_id, name, service_date::text
		FROM trips WHERE route_id = $1 ORDER BY service_date`, routeID)
	if err != nil {
		writeErr(w, 500, "failed to load trips")
		return
	}
	defer rows.Close()

	out := []models.Trip{}
	for rows.Next() {
		var t models.Trip
		if err := rows.Scan(&t.ID, &t.RouteID, &t.Name, &t.ServiceDate); err != nil {
			writeErr(w, 500, "failed to scan trip")
			return
		}
		out = append(out, t)
	}
	writeJSON(w, 200, out)
}
