package fare

const (
	ReservedRatePerKm   = 15.0
	UnreservedRatePerKm = 7.5

	ScenicSurchargeMultiplier = 1.15
)

const (
	ScenicCorridorStartSeq = 4
	ScenicCorridorEndSeq   = 7
)

// applies the scenic surcharge when the leg falls entirely within the scenic corridor
func Quote(distanceKm float64, class string, originSeq, destSeq int) float64 {
	rate := UnreservedRatePerKm
	if class == "reserved" {
		rate = ReservedRatePerKm
	}
	base := distanceKm * rate

	if class == "reserved" && originSeq >= ScenicCorridorStartSeq && destSeq <= ScenicCorridorEndSeq {
		base *= ScenicSurchargeMultiplier
	}

	// Round to 2 decimals
	return float64(int(base*100+0.5)) / 100
}
