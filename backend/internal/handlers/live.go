package handlers

// live.go — WebSocket endpoint for real time train position updates.

// ARCHITECTURE NOTE:
// This stub simulates what a real GPS integration would look like.
// In production, replace the schedule based ticker below with a connection
// to the railway's GPS feed. The message structure stays the same:

//   { "trip_id": 5, "station_id": 12, "station_name": "Kandy", "departed_at": "2026-08-18T08:46:00Z" }

// The frontend connects to /api/trips/:id/live and listens for these messages.
// When a message arrives, it marks that station as departed in the Route Rail.

// Current implementation: emits a message whenever the current wall clock time
// passes a station's scheduled departure time for today's trips. For future dated
// trips, no messages are emitted (the train hasn't run yet).

// To plug in real GPS: replace the goroutine below with a goroutine that reads
// from your GPS broker (MQTT, HTTP stream, etc.) and writes the same JSON
// structure to the conn.

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow all origins in dev
}

type StationDepartedMsg struct {
	TripID      int    `json:"trip_id"`
	StationID   int    `json:"station_id"`
	StationName string `json:"station_name"`
	DepartedAt  string `json:"departed_at"`
}

// LiveTripUpdates upgrades the connection to WebSocket and streams station
// departure events for the given trip. Only emits for trips running today.

// URL: GET /api/trips/:tripID/live
// Protocol: WebSocket
// Messages: JSON StationDepartedMsg, one per station as its scheduled departure time passes. Client should close when done.
func (a *API) LiveTripUpdates(w http.ResponseWriter, r *http.Request, tripID int) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Fetch trip date and stops
	var serviceDate string
	err = a.DB.QueryRow(`SELECT service_date::text FROM trips WHERE id = $1`, tripID).Scan(&serviceDate)
	if err != nil {
		return
	}

	today := time.Now().UTC().Format("2006-01-02")
	if serviceDate != today {
		_ = conn.WriteJSON(map[string]string{
			"type":    "info",
			"message": "real-time updates only available for today's trips",
		})
		return
	}

	// Fetch all stops with their departure times
	type stop struct {
		StationID   int
		StationName string
		DepTime     *string
	}
	rows, err := a.DB.Query(`
		SELECT ts.station_id, s.name, to_char(ts.departure_time, 'HH24:MI')
		FROM trip_stops ts
		JOIN stations s ON s.id = ts.station_id
		WHERE ts.trip_id = $1
		ORDER BY ts.seq_in_trip`, tripID)
	if err != nil {
		return
	}
	var stops []stop
	for rows.Next() {
		var st stop
		if err := rows.Scan(&st.StationID, &st.StationName, &st.DepTime); err != nil {
			continue
		}
		stops = append(stops, st)
	}
	rows.Close()

	// Poll every 30 seconds and emit departure messages for stations whose scheduled departure time has now passed
	emitted := map[int]bool{}
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Also check immediately on connect
	checkAndEmit := func() bool {
		now := time.Now()
		for _, st := range stops {
			if st.DepTime == nil || emitted[st.StationID] {
				continue
			}
			var h, m int
			if _, err := fmt.Sscanf(*st.DepTime, "%d:%d", &h, &m); err != nil {
				continue
			}
			depTime := time.Date(now.Year(), now.Month(), now.Day(), h, m, 0, 0, time.UTC)
			if now.After(depTime) {
				msg := StationDepartedMsg{
					TripID:      tripID,
					StationID:   st.StationID,
					StationName: st.StationName,
					DepartedAt:  depTime.Format(time.RFC3339),
				}
				data, _ := json.Marshal(msg)
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					return false // client disconnected
				}
				emitted[st.StationID] = true
			}
		}
		return true
	}

	if !checkAndEmit() {
		return
	}

	// Handle ping/pong to detect disconnection
	conn.SetReadDeadline(time.Now().Add(24 * time.Hour))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(24 * time.Hour))
		return nil
	})

	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case <-ticker.C:
			if !checkAndEmit() {
				return
			}
		case <-pingTicker.C:
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
