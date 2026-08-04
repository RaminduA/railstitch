package fare

import (
	"database/sql"
	"fmt"
	"time"
)

const BaseFare = 180.0

var zoneMultipliers = [5]float64{
	1.0, // 0 crossings (intra-zone)
	1.7, // 1 crossing
	2.3, // 2 crossings
	2.8, // 3 crossings
	3.2, // 4 crossings
}

var classMultipliers = map[string]float64{
	"third":  1.0,
	"second": 1.8,
	"first":  3.0,
}

var passengerMultipliers = map[string]float64{
	"adult":   1.0,
	"child":   0.5,
	"student": 0.7,
	"senior":  0.75,
}

type Input struct {
	OriginZone         int
	DestZone           int
	CoachClass         string
	OccupancyPct       float64
	DaysUntilDeparture int
	PassengerType      string
}

func QuoteWithoutDB(in Input) int {
	return compute(in)
}

// Quote queries the current leg occupancy from the database itself
func Quote(db *sql.DB, tripID int, originSeq, destSeq int, in Input) (int, error) {
	minSeq, maxSeq := originSeq, destSeq
	if minSeq > maxSeq {
		minSeq, maxSeq = maxSeq, minSeq
	}
	var occupied, total int
	err := db.QueryRow(`
		SELECT
			COUNT(DISTINCT b.seat_id),
			(SELECT COUNT(*) FROM seats s2
			 JOIN coaches c2 ON c2.id = s2.coach_id
			 JOIN routes r ON r.id = c2.route_id
			 JOIN trips t ON t.route_id = r.id
			 WHERE t.id = $1 AND c2.class != 'unreserved')
		FROM bookings b
		WHERE b.trip_id = $1 AND b.status = 'confirmed'
		AND b.seg && int4range($2, $3)`,
		tripID, minSeq, maxSeq,
	).Scan(&occupied, &total)
	if err != nil {
		return 0, fmt.Errorf("fare.Quote: occupancy query: %w", err)
	}
	if total > 0 {
		in.OccupancyPct = float64(occupied) / float64(total) * 100
	}
	return compute(in), nil
}

func compute(in Input) int {
	crossings := abs(in.DestZone - in.OriginZone)
	if crossings > 4 {
		crossings = 4
	}
	zoneMult := zoneMultipliers[crossings]

	classMult, ok := classMultipliers[in.CoachClass]
	if !ok {
		classMult = 1.0
	}

	demandMult := demandMultiplier(in.OccupancyPct)
	timeMult := timeMultiplier(in.DaysUntilDeparture)

	typeMult, ok := passengerMultipliers[in.PassengerType]
	if !ok {
		typeMult = 1.0
	}

	raw := BaseFare * zoneMult * classMult * demandMult * timeMult * typeMult
	return roundTo10(raw)
}

func demandMultiplier(occupancyPct float64) float64 {
	switch {
	case occupancyPct < 30:
		return 0.85
	case occupancyPct < 60:
		return 1.0
	case occupancyPct < 80:
		return 1.2
	default:
		return 1.5
	}
}

func timeMultiplier(daysUntilDeparture int) float64 {
	switch {
	case daysUntilDeparture > 14:
		return 0.9
	case daysUntilDeparture >= 7:
		return 1.0
	case daysUntilDeparture >= 3:
		return 1.1
	case daysUntilDeparture >= 1:
		return 1.3
	default: // same day
		return 1.5
	}
}

func roundTo10(v float64) int {
	return int((v+5)/10) * 10
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func DaysUntil(serviceDate time.Time) int {
	now := time.Now().UTC().Truncate(24 * time.Hour)
	svc := serviceDate.UTC().Truncate(24 * time.Hour)
	d := int(svc.Sub(now).Hours() / 24)
	if d < 0 {
		return 0
	}
	return d
}
