package fare

const (
	ReservedRatePerKm   = 15.0
	UnreservedRatePerKm = 7.5
)

// Computes the fare for a leg of the given distance, for the given class
func Quote(distanceKm float64, class string) float64 {
	rate := UnreservedRatePerKm
	if class == "reserved" {
		rate = ReservedRatePerKm
	}
	base := distanceKm * rate

	return base
}
