"use client";

import { useEffect, useState } from "react";
import {
  api,
  type Booking,
  type SeatAvailability,
} from "@/lib/api";
import { addMyBooking } from "@/lib/myBookings";

type Props = {
  tripId: number;
  originId: number;
  destId: number;
};

type Status = "loading" | "ready" | "error";

export function SeatPicker({ tripId, originId, destId }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [seats, setSeats] = useState<SeatAvailability[]>([]);
  const [fare, setFare] = useState<number | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [passengerNames, setPassengerNames] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlisted, setWaitlisted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .getAvailability(tripId, originId, destId, "reserved")
      .then((res) => {
        if (cancelled) return;
        setSeats(res.seats);
        setFare(res.fare ?? res.fare_estimate ?? null);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [tripId, originId, destId]);

  function toggleSeat(seatId: number) {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId)
        ? prev.filter((id) => id !== seatId)
        : [...prev, seatId],
    );
    setPassengerNames((prev) => {
      if (!(seatId in prev)) return prev;
      const next = { ...prev };
      delete next[seatId];
      return next;
    });
  }

  const allNamesFilled =
    selectedSeatIds.length > 0 &&
    selectedSeatIds.every((id) => passengerNames[id]?.trim());

  async function refreshAvailability() {
    const res = await api.getAvailability(tripId, originId, destId, "reserved");
    setSeats(res.seats);
    setFare(res.fare ?? res.fare_estimate ?? null);
  }

  async function handleBookAll() {
    if (!allNamesFilled) return;
    setSubmitting(true);
    setError(null);

    const results = await Promise.allSettled(
      selectedSeatIds.map((seatId) =>
        api.createBooking(tripId, {
          origin_station_id: originId,
          dest_station_id: destId,
          passenger_name: passengerNames[seatId].trim(),
          seat_id: seatId,
        }),
      ),
    );

    const succeeded: Booking[] = [];
    const failedSeatIds: number[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        succeeded.push(r.value);
      } else {
        failedSeatIds.push(selectedSeatIds[i]);
      }
    });

    if (succeeded.length > 0) {
      setConfirmedBookings((prev) => [...prev, ...succeeded]);
      succeeded.forEach(addMyBooking);
    }

    await refreshAvailability();

    if (failedSeatIds.length > 0) {
      setSelectedSeatIds(failedSeatIds);
      setError(
        failedSeatIds.length === selectedSeatIds.length
          ? "Those seats were just booked by someone else. Pick different seats below."
          : `${succeeded.length} seat${succeeded.length === 1 ? "" : "s"} confirmed. ${failedSeatIds.length} ${failedSeatIds.length === 1 ? "was" : "were"} taken by someone else in the meantime -- pick again below.`,
      );
    } else {
      setSelectedSeatIds([]);
      setPassengerNames({});
    }

    setSubmitting(false);
  }

  async function handleWaitlist() {
    if (!waitlistName.trim()) return;
    setSubmitting(true);
    try {
      await api.createWaitlistEntry(tripId, {
        origin_station_id: originId,
        dest_station_id: destId,
        passenger_name: waitlistName.trim(),
      });
      setWaitlisted(true);
    } catch {
      setError("Couldn't join the waitlist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return <SeatGridSkeleton />;
  }

  if (status === "error") {
    return (
      <p className="font-mono text-sm text-signal-rust py-4">
        Couldn&apos;t reach the booking service. Please try again shortly.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {confirmedBookings.length > 0 && (
        <div className="flex flex-col gap-2">
          {confirmedBookings.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border-2 border-brass bg-white/60 px-5 py-4"
            >
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-brass mb-1">
                Ticket confirmed
              </p>
              <p className="font-display text-xl text-rail-green">
                Coach {b.coach_number}, Seat {b.seat_number}
              </p>
              <p className="text-ink/70 text-sm">
                {b.passenger_name} &middot; {b.origin_name} &rarr; {b.dest_name}
              </p>
              <p className="font-mono text-xs text-ink/60 mt-1">
                Rs. {b.fare.toFixed(2)} &middot; booking #{b.id}
              </p>
            </div>
          ))}
        </div>
      )}

      {waitlisted ? (
        <div className="rounded-lg border border-brass/60 bg-white/40 px-5 py-6">
          <p className="font-display text-xl text-rail-green mb-1">
            You&apos;re on the waitlist
          </p>
          <p className="text-ink/70 text-sm">
            If a seat frees up on this leg, it&apos;s yours automatically,
            oldest request first.
          </p>
        </div>
      ) : seats.length === 0 ? (
        <div className="rounded-lg border border-signal-rust/40 bg-white/40 px-5 py-4">
          <p className="text-ink/80 mb-3">
            No reserved seats are free for this leg right now.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              type="text"
              placeholder="Passenger name"
              value={waitlistName}
              onChange={(e) => setWaitlistName(e.target.value)}
              className="flex-1 rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass"
            />
            <button
              onClick={handleWaitlist}
              disabled={submitting || !waitlistName.trim()}
              className="rounded-md bg-rail-green text-paper px-5 py-2 font-medium disabled:opacity-40 hover:bg-rail-green-dim transition-colors"
            >
              {submitting ? "Please wait\u2026" : "Join the waitlist"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50">
            {seats.length} seat{seats.length === 1 ? "" : "s"} available
            {fare !== null ? ` \u00b7 Rs. ${fare.toFixed(2)} per seat` : ""}
          </p>

          <div className="flex flex-col gap-4">
            {groupByCoach(seats).map(([coachNumber, coachSeats]) => (
              <div key={coachNumber}>
                <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink/40 mb-2">
                  Coach {coachNumber}
                </p>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {coachSeats.map((seat) => {
                    const isSelected = selectedSeatIds.includes(seat.seat_id);
                    return (
                      <button
                        key={seat.seat_id}
                        onClick={() => toggleSeat(seat.seat_id)}
                        aria-pressed={isSelected}
                        className={
                          "rounded-md border py-2 font-mono text-xs transition-colors " +
                          (isSelected
                            ? "border-brass bg-brass text-paper"
                            : "border-rail-green/25 bg-white/50 hover:border-brass")
                        }
                      >
                        {seat.seat_number}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {selectedSeatIds.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-rail-green/15 bg-white/40 px-4 py-4">
              <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50">
                {selectedSeatIds.length} seat
                {selectedSeatIds.length === 1 ? "" : "s"} selected
                {fare !== null
                  ? ` \u00b7 Rs. ${(fare * selectedSeatIds.length).toFixed(2)} total`
                  : ""}
              </p>
              {selectedSeatIds.map((seatId) => {
                const seat = seats.find((s) => s.seat_id === seatId);
                return (
                  <div key={seatId} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-ink/60 w-14 shrink-0">
                      {seat ? `${seat.coach_number}-${seat.seat_number}` : seatId}
                    </span>
                    <input
                      type="text"
                      placeholder="Passenger name"
                      value={passengerNames[seatId] ?? ""}
                      onChange={(e) =>
                        setPassengerNames((prev) => ({
                          ...prev,
                          [seatId]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass"
                    />
                    <button
                      onClick={() => toggleSeat(seatId)}
                      aria-label={`Remove seat ${seat ? seat.seat_number : seatId}`}
                      className="text-ink/40 hover:text-signal-rust px-2"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
              <button
                onClick={handleBookAll}
                disabled={submitting || !allNamesFilled}
                className="self-start rounded-md bg-rail-green text-paper px-5 py-2 font-medium disabled:opacity-40 hover:bg-rail-green-dim transition-colors"
              >
                {submitting
                  ? "Please wait\u2026"
                  : `Book ${selectedSeatIds.length} seat${selectedSeatIds.length === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="text-signal-rust text-sm">{error}</p>}
    </div>
  );
}

function groupByCoach(
  seats: SeatAvailability[],
): [string, SeatAvailability[]][] {
  const map = new Map<string, SeatAvailability[]>();
  for (const seat of seats) {
    const list = map.get(seat.coach_number) ?? [];
    list.push(seat);
    map.set(seat.coach_number, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function SeatGridSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-3 w-48 rounded bg-ink/10" />
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="h-3 w-20 rounded bg-ink/10 mb-2" />
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 rounded-md bg-rail-green/10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}