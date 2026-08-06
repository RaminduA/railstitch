package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"
)

func hmacSecret() []byte {
	s := os.Getenv("HMAC_SECRET")
	if s == "" {
		s = "dev-secret-change-in-production"
	}
	return []byte(s)
}

func VerificationToken(bookingID int, createdAt time.Time) string {
	msg := fmt.Sprintf("%d|%d", bookingID, createdAt.Unix())
	mac := hmac.New(sha256.New, hmacSecret())
	mac.Write([]byte(msg))
	return hex.EncodeToString(mac.Sum(nil))[:16]
}

// POST /api/auth/upsert-user
func (a *API) UpsertUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := decodeJSON(r, &req); err != nil || req.ID == "" || req.Email == "" {
		writeErr(w, 400, "id and email are required")
		return
	}

	type userRow struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
		IsAdmin   bool   `json:"is_admin"`
	}
	var u userRow
	err := a.DB.QueryRow(`
		INSERT INTO users (id, email, name, avatar_url)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (email) DO UPDATE
		  SET email = EXCLUDED.email,
		      name = EXCLUDED.name,
		      avatar_url = EXCLUDED.avatar_url
		RETURNING id, email, name, avatar_url, is_admin`,
		req.ID, req.Email, req.Name, req.AvatarURL,
	).Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.IsAdmin)
	if err != nil {
		writeErr(w, 500, "failed to upsert user")
		return
	}
	writeJSON(w, 200, u)
}

// GET /api/bookings/:id/verify?token=...
func (a *API) VerifyBooking(w http.ResponseWriter, r *http.Request, bookingID int) {
	token := r.URL.Query().Get("token")
	if token == "" {
		writeErr(w, 400, "token is required")
		return
	}

	b, err := a.getBookingByID(bookingID)
	if err != nil {
		writeErr(w, 404, "booking not found")
		return
	}

	// Fetch the stored verification token
	var storedToken *string
	var createdAt time.Time
	_ = a.DB.QueryRow(
		`SELECT verification_token, created_at FROM bookings WHERE id = $1`, bookingID,
	).Scan(&storedToken, &createdAt)

	// Validate: check stored token first, then recompute as fallback
	valid := false
	if storedToken != nil && *storedToken == token {
		valid = true
	} else {
		expected := VerificationToken(bookingID, createdAt)
		valid = hmac.Equal([]byte(token), []byte(expected))
	}

	if !valid {
		writeErr(w, 403, "invalid verification token")
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"booking": b,
		"valid":   true,
	})
}

// GET /api/users/:userID/bookings
func (a *API) UserBookings(w http.ResponseWriter, r *http.Request, userID string) {
	rows, err := a.DB.Query(`
		SELECT b.id, b.trip_id, b.seat_id, c.coach_number, c.class, s.seat_number,
		       b.origin_station_id, b.dest_station_id, os.name, ds.name,
		       to_char(ots.departure_time, 'HH24:MI'),
		       to_char(dts.arrival_time, 'HH24:MI'),
		       b.passenger_name, b.passenger_type, b.fare, b.status, b.created_at,
		       b.verification_token,
		       t.name, t.service_date::text, t.direction
		FROM bookings b
		JOIN seats s      ON s.id = b.seat_id
		JOIN coaches c    ON c.id = s.coach_id
		JOIN stations os  ON os.id = b.origin_station_id
		JOIN stations ds  ON ds.id = b.dest_station_id
		LEFT JOIN trip_stops ots ON ots.trip_id = b.trip_id AND ots.station_id = b.origin_station_id
		LEFT JOIN trip_stops dts ON dts.trip_id = b.trip_id AND dts.station_id = b.dest_station_id
		JOIN trips t      ON t.id = b.trip_id
		WHERE b.user_id = $1
		ORDER BY b.created_at DESC`, userID)
	if err != nil {
		writeErr(w, 500, "failed to load bookings")
		return
	}
	defer rows.Close()

	type bookingWithTrip struct {
		ID                  int     `json:"id"`
		TripID              int     `json:"trip_id"`
		TripName            string  `json:"trip_name"`
		ServiceDate         string  `json:"service_date"`
		Direction           string  `json:"direction"`
		SeatID              int     `json:"seat_id"`
		CoachNumber         string  `json:"coach_number"`
		CoachClass          string  `json:"coach_class"`
		SeatNumber          int     `json:"seat_number"`
		OriginStationID     int     `json:"origin_station_id"`
		DestStationID       int     `json:"dest_station_id"`
		OriginName          string  `json:"origin_name"`
		DestName            string  `json:"dest_name"`
		OriginDepartureTime *string `json:"origin_departure_time"`
		DestArrivalTime     *string `json:"dest_arrival_time"`
		PassengerName       string  `json:"passenger_name"`
		PassengerType       string  `json:"passenger_type"`
		Fare                float64 `json:"fare"`
		Status              string  `json:"status"`
		CreatedAt           string  `json:"created_at"`
		VerificationToken   *string `json:"verification_token"`
	}

	out := []bookingWithTrip{}
	for rows.Next() {
		var b bookingWithTrip
		var createdAt time.Time
		if err := rows.Scan(
			&b.ID, &b.TripID, &b.SeatID, &b.CoachNumber, &b.CoachClass, &b.SeatNumber,
			&b.OriginStationID, &b.DestStationID, &b.OriginName, &b.DestName,
			&b.OriginDepartureTime, &b.DestArrivalTime,
			&b.PassengerName, &b.PassengerType, &b.Fare, &b.Status, &createdAt,
			&b.VerificationToken, &b.TripName, &b.ServiceDate, &b.Direction,
		); err != nil {
			writeErr(w, 500, "failed to scan booking")
			return
		}
		b.CreatedAt = createdAt.Format(time.RFC3339)
		out = append(out, b)
	}
	writeJSON(w, 200, out)
}

func intStr(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}
