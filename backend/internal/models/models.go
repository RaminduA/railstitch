package models

import "time"

type Station struct {
	ID         int     `json:"id"`
	RouteID    int     `json:"route_id"`
	Name       string  `json:"name"`
	Seq        int     `json:"seq"`
	DistanceKm float64 `json:"distance_km"`
}

type Coach struct {
	ID          int    `json:"id"`
	RouteID     int    `json:"route_id"`
	CoachNumber string `json:"coach_number"`
	Class       string `json:"class"`
	SeatCount   int    `json:"seat_count"`
}

type Trip struct {
	ID          int    `json:"id"`
	RouteID     int    `json:"route_id"`
	Name        string `json:"name"`
	ServiceDate string `json:"service_date"`
}

type SeatAvailability struct {
	SeatID      int     `json:"seat_id"`
	CoachNumber string  `json:"coach_number"`
	SeatNumber  int     `json:"seat_number"`
	Fare        float64 `json:"fare"`
}

type Booking struct {
	ID              int       `json:"id"`
	TripID          int       `json:"trip_id"`
	SeatID          int       `json:"seat_id"`
	CoachNumber     string    `json:"coach_number,omitempty"`
	SeatNumber      int       `json:"seat_number,omitempty"`
	OriginStationID int       `json:"origin_station_id"`
	DestStationID   int       `json:"dest_station_id"`
	OriginName      string    `json:"origin_name,omitempty"`
	DestName        string    `json:"dest_name,omitempty"`
	PassengerName   string    `json:"passenger_name"`
	Fare            float64   `json:"fare"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

type WaitlistEntry struct {
	ID              int       `json:"id"`
	TripID          int       `json:"trip_id"`
	OriginStationID int       `json:"origin_station_id"`
	DestStationID   int       `json:"dest_station_id"`
	Class           string    `json:"class"`
	PassengerName   string    `json:"passenger_name"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

type BookingRequest struct {
	OriginStationID int    `json:"origin_station_id"`
	DestStationID   int    `json:"dest_station_id"`
	Class           string `json:"class"`
	PassengerName   string `json:"passenger_name"`
	SeatID          int    `json:"seat_id"`
}

type WaitlistRequest struct {
	OriginStationID int    `json:"origin_station_id"`
	DestStationID   int    `json:"dest_station_id"`
	Class           string `json:"class"`
	PassengerName   string `json:"passenger_name"`
}
