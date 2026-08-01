"use client";

import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  type Booking,
  type SeatAvailability,
} from "@/lib/api";

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
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null);
  const [passengerName, setPassengerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function handleBook() {
    if (!selectedSeatId || !passengerName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await api.createBooking(tripId, {
        origin_station_id: originId,
        dest_station_id: destId,
        passenger_name: passengerName.trim(),
        seat_id: selectedSeatId,
      });
      setConfirmed(booking);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(
          "That seat was just booked by someone else. Pick another seat below.",
        );
        const res = await api.getAvailability(tripId, originId, destId, "reserved");
        setSeats(res.seats);
        setSelectedSeatId(null);
      } else {
        setError("Something went wrong booking that seat. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWaitlist() {
    if (!passengerName.trim()) return;
    setSubmitting(true);
    try {
      await api.createWaitlistEntry(tripId, {
        origin_station_id: originId,
        dest_station_id: destId,
        passenger_name: passengerName.trim(),
      });
      setWaitlisted(true);
    } catch {
      setError("Couldn't join the waitlist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <p className="font-mono text-sm text-ink/60 py-4">
        Checking which seats are free for this leg&hellip;
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="font-mono text-sm text-signal-rust py-4">
        Couldn&apos;t reach the booking service. Please try again shortly.
      </p>
    );
  }

  if (confirmed) {
    return (
      <div className="rounded-lg border-2 border-brass bg-white/60 px-5 py-6">
        <p className="font-mono text-xs tracking-[0.15em] uppercase text-brass mb-2">
          Ticket confirmed
        </p>
        <p className="font-display text-2xl text-rail-green mb-1">
          Coach {confirmed.coach_number}, Seat {confirmed.seat_number}
        </p>
        <p className="text-ink/70">
          {confirmed.passenger_name} &middot; {confirmed.origin_name} &rarr;{" "}
          {confirmed.dest_name}
        </p>
        <p className="font-mono text-sm text-ink/60 mt-2">
          Rs. {confirmed.fare.toFixed(2)} &middot; booking #{confirmed.id}
        </p>
      </div>
    );
  }

  if (waitlisted) {
    return (
      <div className="rounded-lg border border-brass/60 bg-white/40 px-5 py-6">
        <p className="font-display text-xl text-rail-green mb-1">
          You&apos;re on the waitlist
        </p>
        <p className="text-ink/70 text-sm">
          If a seat frees up on this leg, it&apos;s yours automatically,
          oldest request first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {seats.length === 0 ? (
        <div className="rounded-lg border border-signal-rust/40 bg-white/40 px-5 py-4">
          <p className="text-ink/80 mb-3">
            No reserved seats are free for this leg right now.
          </p>
          <PassengerNameAndAction
            passengerName={passengerName}
            setPassengerName={setPassengerName}
            submitting={submitting}
            actionLabel="Join the waitlist"
            onAction={handleWaitlist}
          />
        </div>
      ) : (
        <>
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50">
            {seats.length} seat{seats.length === 1 ? "" : "s"} available
            {fare !== null ? ` \u00b7 Rs. ${fare.toFixed(2)} per seat` : ""}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {seats.map((seat) => (
              <button
                key={seat.seat_id}
                onClick={() => setSelectedSeatId(seat.seat_id)}
                className={
                  "rounded-md border px-2 py-3 font-mono text-sm transition-colors " +
                  (selectedSeatId === seat.seat_id
                    ? "border-brass bg-brass text-paper"
                    : "border-rail-green/25 bg-white/50 hover:border-brass")
                }
              >
                {seat.coach_number}-{seat.seat_number}
              </button>
            ))}
          </div>

          <PassengerNameAndAction
            passengerName={passengerName}
            setPassengerName={setPassengerName}
            submitting={submitting}
            actionLabel="Book this seat"
            disabled={!selectedSeatId}
            onAction={handleBook}
          />
        </>
      )}

      {error && <p className="text-signal-rust text-sm">{error}</p>}
    </div>
  );
}

function PassengerNameAndAction({
  passengerName,
  setPassengerName,
  submitting,
  actionLabel,
  onAction,
  disabled,
}: {
  passengerName: string;
  setPassengerName: (v: string) => void;
  submitting: boolean;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
      <input
        type="text"
        placeholder="Passenger name"
        value={passengerName}
        onChange={(e) => setPassengerName(e.target.value)}
        className="flex-1 rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass"
      />
      <button
        onClick={onAction}
        disabled={disabled || submitting || !passengerName.trim()}
        className="rounded-md bg-rail-green text-paper px-5 py-2 font-medium disabled:opacity-40 hover:bg-rail-green-dim transition-colors"
      >
        {submitting ? "Please wait\u2026" : actionLabel}
      </button>
    </div>
  );
}