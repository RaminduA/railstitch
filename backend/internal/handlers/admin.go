package handlers

import (
	"net/http"

	"railstitch/internal/models"
)

type legOccupancy struct {
	FromStation string  `json:"from_station"`
	ToStation   string  `json:"to_station"`
	Occupied    int     `json:"occupied_seats"`
	Capacity    int     `json:"capacity"`
	Pct         float64 `json:"occupancy_pct"`
}

type tripSummary struct {
	TripID         int            `json:"trip_id"`
	TotalRevenue   float64        `json:"total_revenue"`
	ConfirmedCount int            `json:"confirmed_bookings"`
	CancelledCount int            `json:"cancelled_bookings"`
	WaitingCount   int            `json:"waiting_count"`
	ReservedSeats  int            `json:"reserved_seat_capacity"`
	LegOccupancy   []legOccupancy `json:"leg_occupancy"`
}

// GET /api/admin/trips/{tripID}/summary
func (a *API) TripSummary(w http.ResponseWriter, r *http.Request, tripID int) {
	routeID, err := a.getTripRoute(tripID)
	if err != nil {
		writeErr(w, 404, "trip not found")
		return
	}

	var summary tripSummary
	summary.TripID = tripID

	err = a.DB.QueryRow(`
		SELECT COALESCE(SUM(fare), 0) FROM bookings
		WHERE trip_id = $1 AND status = 'confirmed'`, tripID).Scan(&summary.TotalRevenue)
	if err != nil {
		writeErr(w, 500, "failed to compute revenue")
		return
	}

	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM bookings WHERE trip_id = $1 AND status = 'confirmed'`, tripID).Scan(&summary.ConfirmedCount)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM bookings WHERE trip_id = $1 AND status = 'cancelled'`, tripID).Scan(&summary.CancelledCount)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM waitlist_entries WHERE trip_id = $1 AND status = 'waiting'`, tripID).Scan(&summary.WaitingCount)
	_ = a.DB.QueryRow(`
		SELECT COUNT(*) FROM seats s JOIN coaches c ON c.id = s.coach_id
		WHERE c.route_id = $1 AND c.class = 'reserved'`, routeID).Scan(&summary.ReservedSeats)

	stations, err := a.stationsForRoute(routeID)
	if err != nil {
		writeErr(w, 500, "failed to load stations")
		return
	}

	for i := 0; i < len(stations)-1; i++ {
		from, to := stations[i], stations[i+1]
		var occupied int
		err := a.DB.QueryRow(`
			SELECT COUNT(DISTINCT seat_id) FROM bookings
			WHERE trip_id = $1 AND status = 'confirmed'
			AND seg && int4range($2, $3)`, tripID, from.Seq, to.Seq).Scan(&occupied)
		if err != nil {
			writeErr(w, 500, "failed to compute leg occupancy")
			return
		}
		pct := 0.0
		if summary.ReservedSeats > 0 {
			pct = float64(occupied) / float64(summary.ReservedSeats) * 100
		}
		summary.LegOccupancy = append(summary.LegOccupancy, legOccupancy{
			FromStation: from.Name,
			ToStation:   to.Name,
			Occupied:    occupied,
			Capacity:    summary.ReservedSeats,
			Pct:         pct,
		})
	}

	writeJSON(w, 200, summary)
}

func (a *API) stationsForRoute(routeID int) ([]models.Station, error) {
	rows, err := a.DB.Query(`
		SELECT id, route_id, name, seq, distance_km
		FROM stations WHERE route_id = $1 ORDER BY seq`, routeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Station
	for rows.Next() {
		var s models.Station
		if err := rows.Scan(&s.ID, &s.RouteID, &s.Name, &s.Seq, &s.DistanceKm); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}
