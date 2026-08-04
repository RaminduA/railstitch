package models

import "time"

type Station struct {
	ID         int     `json:"id"`
	RouteID    int     `json:"route_id"`
	Name       string  `json:"name"`
	Seq        int     `json:"seq"`
	DistanceKm float64 `json:"distance_km"`
	Zone       int     `json:"zone"`
}

type Coach struct {
	ID           int    `json:"id"`
	RouteID      int    `json:"route_id"`
	CoachNumber  string `json:"coach_number"`
	Class        string `json:"class"` // "first" | "second" | "third" | "unreserved"
	SeatCount    int    `json:"seat_count"`
	DisplayOrder int    `json:"display_order"`
}

type Trip struct {
	ID                int    `json:"id"`
	RouteID           int    `json:"route_id"`
	Name              string `json:"name"`
	ServiceDate       string `json:"service_date"`
	Direction         string `json:"direction"` // "outbound" | "inbound"
	OvernightOutbound bool   `json:"overnight_outbound"`
	OvernightInbound  bool   `json:"overnight_inbound"`
}

type TripStop struct {
	ID            int     `json:"id"`
	TripID        int     `json:"trip_id"`
	StationID     int     `json:"station_id"`
	StationName   string  `json:"station_name"`
	Seq           int     `json:"seq"`
	SeqInTrip     int     `json:"seq_in_trip"`
	Zone          int     `json:"zone"`
	DistanceKm    float64 `json:"distance_km"`
	ArrivalTime   *string `json:"arrival_time"`
	DepartureTime *string `json:"departure_time"`
	CanBoard      bool    `json:"can_board"`
}

type SeatWithStatus struct {
	SeatID        int    `json:"seat_id"`
	CoachNumber   string `json:"coach_number"`
	CoachClass    string `json:"coach_class"`
	SeatNumber    int    `json:"seat_number"`
	Available     bool   `json:"available"`
	BlockedOrigin string `json:"blocked_origin,omitempty"`
	BlockedDest   string `json:"blocked_dest,omitempty"`
}

type AvailabilityResponse struct {
	TripID   int              `json:"trip_id"`
	OriginID int              `json:"origin_station_id"`
	DestID   int              `json:"dest_station_id"`
	Coaches  []CoachWithSeats `json:"coaches"`
}

type CoachWithSeats struct {
	CoachID      int              `json:"coach_id"`
	CoachNumber  string           `json:"coach_number"`
	Class        string           `json:"class"`
	DisplayOrder int              `json:"display_order"`
	FareAdult    int              `json:"fare_adult"`
	Seats        []SeatWithStatus `json:"seats"`
}

type Booking struct {
	ID              int       `json:"id"`
	TripID          int       `json:"trip_id"`
	SeatID          int       `json:"seat_id"`
	CoachNumber     string    `json:"coach_number,omitempty"`
	CoachClass      string    `json:"coach_class,omitempty"`
	SeatNumber      int       `json:"seat_number,omitempty"`
	OriginStationID int       `json:"origin_station_id"`
	DestStationID   int       `json:"dest_station_id"`
	OriginName      string    `json:"origin_name,omitempty"`
	DestName        string    `json:"dest_name,omitempty"`
	PassengerName   string    `json:"passenger_name"`
	PassengerType   string    `json:"passenger_type"`
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
	PassengerType   string    `json:"passenger_type"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

type BookingRequest struct {
	OriginStationID int    `json:"origin_station_id"`
	DestStationID   int    `json:"dest_station_id"`
	SeatID          int    `json:"seat_id"`
	PassengerName   string `json:"passenger_name"`
	PassengerType   string `json:"passenger_type"` // "adult"|"child"|"student"|"senior"
	Class           string `json:"class"`          // "first"|"second"|"third"
	UserID          string `json:"user_id"`        // Google sub, optional
}

type WaitlistRequest struct {
	OriginStationID int    `json:"origin_station_id"`
	DestStationID   int    `json:"dest_station_id"`
	Class           string `json:"class"`
	PassengerName   string `json:"passenger_name"`
	PassengerType   string `json:"passenger_type"`
}
