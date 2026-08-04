"use client";

import { useEffect, useState } from "react";
import {
  api,
  type AvailabilityResponse,
  type Booking,
  type CoachWithSeats,
} from "@/lib/api";
import { addMyBooking } from "@/lib/myBookings";

type Props = {
  tripId: number;
  originId: number;
  destId: number;
};

type Status = "loading" | "ready" | "error";

const CLASS_LABELS: Record<string, string> = {
  first:  "1st Class — Air Conditioned",
  second: "2nd Class — Reserved",
  third:  "3rd Class — Reserved",
};

const CLASS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  first:  { bg: "bg-amber-50",   text: "text-amber-900",  border: "border-amber-300" },
  second: { bg: "bg-sky-50",     text: "text-sky-900",    border: "border-sky-300"   },
  third:  { bg: "bg-emerald-50", text: "text-emerald-900",border: "border-emerald-300"},
};

const PASSENGER_TYPES = [
  { value: "adult",   label: "Adult (full fare)" },
  { value: "child",   label: "Child (50%)" },
  { value: "student", label: "Student (70%)" },
  { value: "senior",  label: "Senior (75%)" },
];

export function SeatPicker({ tripId, originId, destId }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<
    { seatId: number; coachClass: string; fareAdult: number }[]
  >([]);
  const [passengerNames, setPassengerNames] = useState<Record<number, string>>({});
  const [passengerTypes, setPassengerTypes] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistType, setWaitlistType] = useState("adult");
  const [waitlisted, setWaitlisted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    api.getAvailability(tripId, originId, destId)
      .then((res) => {
        if (!cancelled) {
          setAvailability(res);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [tripId, originId, destId]);

  async function refreshAvailability() {
    const res = await api.getAvailability(tripId, originId, destId);
    setAvailability(res);
  }

  function toggleSeat(seatId: number, coachClass: string, fareAdult: number) {
    setSelectedSeats((prev) => {
      const exists = prev.find((s) => s.seatId === seatId);
      if (exists) {
        // Remove passenger data too
        setPassengerNames((n) => { const c = {...n}; delete c[seatId]; return c; });
        setPassengerTypes((t) => { const c = {...t}; delete c[seatId]; return c; });
        return prev.filter((s) => s.seatId !== seatId);
      }
      return [...prev, { seatId, coachClass, fareAdult }];
    });
  }

  function fareForSeat(seatId: number, fareAdult: number): number {
    const type = passengerTypes[seatId] ?? "adult";
    const mult: Record<string, number> = { adult: 1, child: 0.5, student: 0.7, senior: 0.75 };
    return Math.round(fareAdult * (mult[type] ?? 1) / 10) * 10;
  }

  const allFilled = selectedSeats.length > 0 &&
    selectedSeats.every((s) => passengerNames[s.seatId]?.trim());

  async function handleBookAll() {
    if (!allFilled) return;
    setSubmitting(true);
    setError(null);

    const results = await Promise.allSettled(
      selectedSeats.map((s) =>
        api.createBooking(tripId, {
          origin_station_id: originId,
          dest_station_id: destId,
          passenger_name: passengerNames[s.seatId].trim(),
          passenger_type: passengerTypes[s.seatId] ?? "adult",
          seat_id: s.seatId,
          class: s.coachClass,
        }),
      ),
    );

    const succeeded: Booking[] = [];
    const failedSeatIds: number[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        succeeded.push(r.value);
      } else {
        failedSeatIds.push(selectedSeats[i].seatId);
      }
    });

    if (succeeded.length > 0) {
      setConfirmedBookings((prev) => [...prev, ...succeeded]);
      succeeded.forEach(addMyBooking);
    }

    await refreshAvailability();

    if (failedSeatIds.length > 0) {
      setSelectedSeats((prev) => prev.filter((s) => failedSeatIds.includes(s.seatId)));
      setError(
        failedSeatIds.length === selectedSeats.length
          ? "Those seats were just taken by someone else. Pick different seats."
          : `${succeeded.length} seat${succeeded.length > 1 ? "s" : ""} confirmed. ${failedSeatIds.length} ${failedSeatIds.length > 1 ? "were" : "was"} taken — pick again below.`,
      );
    } else {
      setSelectedSeats([]);
      setPassengerNames({});
      setPassengerTypes({});
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
        passenger_type: waitlistType,
      });
      setWaitlisted(true);
    } catch {
      setError("Couldn't join the waitlist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") return <SeatGridSkeleton />;
  if (status === "error") {
    return (
      <p className="font-mono text-sm text-signal-rust py-4">
        Couldn&apos;t reach the booking service. Please try again shortly.
      </p>
    );
  }

  const coaches = availability?.coaches ?? [];
  const totalAvailable = coaches.reduce(
    (n, c) => n + c.seats.filter((s) => s.available).length, 0
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Confirmed tickets */}
      {confirmedBookings.length > 0 && (
        <div className="flex flex-col gap-2">
          {confirmedBookings.map((b) => (
            <div key={b.id} className="rounded-lg border-2 border-brass bg-white/60 px-5 py-4">
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-brass mb-1">
                Ticket confirmed
              </p>
              <p className="font-display text-xl text-rail-green">
                {b.coach_number}, Seat {b.seat_number}
                <span className="ml-2 font-mono text-xs text-ink/50">
                  ({CLASS_LABELS[b.coach_class ?? "third"] ?? b.coach_class})
                </span>
              </p>
              <p className="text-ink/70 text-sm">
                {b.passenger_name} · {b.passenger_type} · {b.origin_name} → {b.dest_name}
              </p>
              <p className="font-mono text-xs text-ink/60 mt-1">
                Rs. {b.fare.toFixed(0)} · booking #{b.id}
              </p>
            </div>
          ))}
        </div>
      )}

      {waitlisted ? (
        <div className="rounded-lg border border-brass/60 bg-white/40 px-5 py-6">
          <p className="font-display text-xl text-rail-green mb-1">You&apos;re on the waitlist</p>
          <p className="text-ink/70 text-sm">
            If a seat frees up on this leg, it&apos;s yours automatically, oldest request first.
          </p>
        </div>
      ) : totalAvailable === 0 ? (
        <div className="rounded-lg border border-signal-rust/40 bg-white/40 px-5 py-4">
          <p className="text-ink/80 mb-3">No reserved seats are free for this leg right now.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text" placeholder="Passenger name" value={waitlistName}
              onChange={(e) => setWaitlistName(e.target.value)}
              className="flex-1 rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass"
            />
            <select value={waitlistType} onChange={(e) => setWaitlistType(e.target.value)}
              className="rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass">
              {PASSENGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button onClick={handleWaitlist} disabled={submitting || !waitlistName.trim()}
              className="rounded-md bg-rail-green text-paper px-5 py-2 font-medium disabled:opacity-40 hover:bg-rail-green-dim transition-colors">
              {submitting ? "Please wait…" : "Join waitlist"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Coach panels: AFC first, TC last */}
          {coaches.map((coach) => (
            <CoachPanel
              key={coach.coach_id}
              coach={coach}
              selectedSeats={selectedSeats}
              onToggle={toggleSeat}
            />
          ))}

          {/* Booking summary panel */}
          {selectedSeats.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-rail-green/15 bg-white/40 px-4 py-4">
              <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50">
                {selectedSeats.length} seat{selectedSeats.length > 1 ? "s" : ""} selected
              </p>
              {selectedSeats.map((sel) => {
                const coach = coaches.find((c) =>
                  c.seats.some((s) => s.seat_id === sel.seatId)
                );
                const seat = coach?.seats.find((s) => s.seat_id === sel.seatId);
                const fare = fareForSeat(sel.seatId, sel.fareAdult);
                return (
                  <div key={sel.seatId} className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-ink/60 w-20 shrink-0">
                      {seat ? `${seat.coach_number}-${seat.seat_number}` : sel.seatId}
                    </span>
                    <input
                      type="text" placeholder="Passenger name"
                      value={passengerNames[sel.seatId] ?? ""}
                      onChange={(e) => setPassengerNames((p) => ({ ...p, [sel.seatId]: e.target.value }))}
                      className="flex-1 min-w-32 rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass text-sm"
                    />
                    <select
                      value={passengerTypes[sel.seatId] ?? "adult"}
                      onChange={(e) => setPassengerTypes((p) => ({ ...p, [sel.seatId]: e.target.value }))}
                      className="rounded-md border border-rail-green/25 bg-white/70 px-2 py-2 outline-none focus:border-brass text-sm"
                    >
                      {PASSENGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <span className="font-mono text-sm text-brass font-medium w-20 text-right">
                      Rs. {fare}
                    </span>
                    <button onClick={() => toggleSeat(sel.seatId, sel.coachClass, sel.fareAdult)}
                      className="text-ink/40 hover:text-signal-rust px-1 text-lg">
                      ×
                    </button>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1 border-t border-rail-green/10">
                <span className="font-mono text-xs text-ink/50">
                  Total: Rs.{" "}
                  {selectedSeats
                    .reduce((sum, s) => sum + fareForSeat(s.seatId, s.fareAdult), 0)
                    .toFixed(0)}
                </span>
                <button
                  onClick={handleBookAll}
                  disabled={submitting || !allFilled}
                  className="rounded-md bg-rail-green text-paper px-5 py-2 font-medium disabled:opacity-40 hover:bg-rail-green-dim transition-colors"
                >
                  {submitting
                    ? "Please wait…"
                    : `Book ${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="text-signal-rust text-sm">{error}</p>}
    </div>
  );
}

function CoachPanel({
  coach,
  selectedSeats,
  onToggle,
}: {
  coach: CoachWithSeats;
  selectedSeats: { seatId: number; coachClass: string; fareAdult: number }[];
  onToggle: (seatId: number, coachClass: string, fareAdult: number) => void;
}) {
  const colors = CLASS_COLORS[coach.class] ?? CLASS_COLORS.third;
  const selectedInCoach = selectedSeats.filter((s) =>
    coach.seats.some((cs) => cs.seat_id === s.seatId)
  ).length;
  const availableCount = coach.seats.filter((s) => s.available).length;

  return (
    <div className={`rounded-xl border px-4 py-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className={`font-mono text-xs font-medium uppercase tracking-wide ${colors.text}`}>
            {coach.coach_number} — {CLASS_LABELS[coach.class]}
          </span>
          <span className="ml-3 font-mono text-xs text-ink/50">
            {availableCount} available
          </span>
        </div>
        <span className={`font-mono text-sm font-medium ${colors.text}`}>
          from Rs. {coach.fare_adult}
        </span>
      </div>

      {/* Seat grid: 6 columns */}
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
        {coach.seats.map((seat) => {
          const isSelected = selectedSeats.some((s) => s.seatId === seat.seat_id);
          const isAvailable = seat.available;
          return (
            <button
              key={seat.seat_id}
              onClick={() => {
                if (isAvailable) onToggle(seat.seat_id, coach.class, coach.fare_adult);
              }}
              disabled={!isAvailable}
              aria-pressed={isSelected}
              title={isAvailable ? `Seat ${seat.seat_number}` : `Seat ${seat.seat_number} — booked`}
              className={[
                "rounded py-2 font-mono text-xs transition-colors",
                isSelected
                  ? "bg-brass text-paper border border-brass"
                  : isAvailable
                  ? `bg-white/70 border border-rail-green/25 hover:border-brass ${colors.text}`
                  : "bg-signal-rust/20 border border-signal-rust/40 text-signal-rust/70 cursor-not-allowed",
              ].join(" ")}
            >
              {seat.seat_number}
            </button>
          );
        })}
      </div>

      {selectedInCoach > 0 && (
        <p className="mt-2 font-mono text-[10px] text-ink/50">
          {selectedInCoach} seat{selectedInCoach > 1 ? "s" : ""} selected in this coach
        </p>
      )}
    </div>
  );
}

function SeatGridSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-3 w-48 rounded bg-ink/10" />
      {["amber", "sky", "emerald"].map((color) => (
        <div key={color} className="rounded-xl border border-rail-green/10 bg-white/30 px-4 py-4">
          <div className="h-4 w-48 rounded bg-ink/10 mb-3" />
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-rail-green/10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
