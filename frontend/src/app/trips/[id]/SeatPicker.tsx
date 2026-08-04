"use client";

import { useEffect, useState } from "react";
import {
  api,
  type AvailabilityResponse,
  type Booking,
  type CoachWithSeats,
  type SeatWithStatus,
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

const CLASS_STYLES: Record<string, { panel: string; header: string; available: string; selected: string; occupied: string }> = {
  first: {
    panel:    "bg-amber-50 border-amber-200",
    header:   "text-amber-900",
    available:"bg-white border-amber-300 text-amber-800 hover:border-amber-500",
    selected: "bg-amber-600 border-amber-600 text-white",
    occupied: "bg-red-100 border-red-300 text-red-400 cursor-not-allowed",
  },
  second: {
    panel:    "bg-sky-50 border-sky-200",
    header:   "text-sky-900",
    available:"bg-white border-sky-300 text-sky-800 hover:border-sky-500",
    selected: "bg-sky-700 border-sky-700 text-white",
    occupied: "bg-red-100 border-red-300 text-red-400 cursor-not-allowed",
  },
  third: {
    panel:    "bg-emerald-50 border-emerald-200",
    header:   "text-emerald-900",
    available:"bg-white border-emerald-300 text-emerald-800 hover:border-emerald-500",
    selected: "bg-emerald-700 border-emerald-700 text-white",
    occupied: "bg-red-100 border-red-300 text-red-400 cursor-not-allowed",
  },
};

// Coach layout config: seats per row for each side (left, right)
// AFC: 2+2, 11 rows = 44 seats
// SC:  2+2, 12 rows = 48 seats
// TC:  3+3, 11 rows = 66 seats
const LAYOUT: Record<string, { left: number; right: number; rows: number }> = {
  first:  { left: 2, right: 2, rows: 11 },
  second: { left: 2, right: 2, rows: 12 },
  third:  { left: 3, right: 3, rows: 11 },
};

const PASSENGER_TYPES = [
  { value: "adult",   label: "Adult" },
  { value: "child",   label: "Child" },
  { value: "student", label: "Student" },
  { value: "senior",  label: "Senior" },
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
      .then((res) => { if (!cancelled) { setAvailability(res); setStatus("ready"); } })
      .catch(() => { if (!cancelled) setStatus("error"); });
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
        setPassengerNames((n) => { const c = { ...n }; delete c[seatId]; return c; });
        setPassengerTypes((t) => { const c = { ...t }; delete c[seatId]; return c; });
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
    const failedIds: number[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") succeeded.push(r.value);
      else failedIds.push(selectedSeats[i].seatId);
    });
    if (succeeded.length > 0) {
      setConfirmedBookings((p) => [...p, ...succeeded]);
      succeeded.forEach(addMyBooking);
    }
    await refreshAvailability();
    if (failedIds.length > 0) {
      setSelectedSeats((p) => p.filter((s) => failedIds.includes(s.seatId)));
      setError(
        failedIds.length === selectedSeats.length
          ? "Those seats were just taken. Pick different seats."
          : `${succeeded.length} confirmed. ${failedIds.length} taken — pick again.`,
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
    return <p className="font-mono text-sm text-signal-rust py-4">Couldn&apos;t reach the booking service.</p>;
  }

  const coaches = availability?.coaches ?? [];
  const totalAvailable = coaches.reduce((n, c) => n + c.seats.filter((s) => s.available).length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Confirmed tickets */}
      {confirmedBookings.length > 0 && (
        <div className="flex flex-col gap-2">
          {confirmedBookings.map((b) => (
            <div key={b.id} className="rounded-lg border-2 border-brass bg-white/60 px-5 py-4">
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-brass mb-1">Ticket confirmed</p>
              <p className="font-display text-xl text-rail-green">
                {b.coach_number}, Seat {b.seat_number}
                <span className="ml-2 font-mono text-xs text-ink/50">({CLASS_LABELS[b.coach_class ?? "third"]})</span>
              </p>
              <p className="text-ink/70 text-sm">{b.passenger_name} · {b.passenger_type} · {b.origin_name} → {b.dest_name}</p>
              <p className="font-mono text-xs text-ink/60 mt-1">Rs. {b.fare.toFixed(0)} · booking #{b.id}</p>
            </div>
          ))}
        </div>
      )}

      {waitlisted ? (
        <div className="rounded-lg border border-brass/60 bg-white/40 px-5 py-6">
          <p className="font-display text-xl text-rail-green mb-1">You&apos;re on the waitlist</p>
          <p className="text-ink/70 text-sm">If a seat frees up, it&apos;s yours automatically — oldest request first.</p>
        </div>
      ) : totalAvailable === 0 ? (
        <div className="rounded-lg border border-signal-rust/40 bg-white/40 px-5 py-4">
          <p className="text-ink/80 mb-3">No reserved seats are free for this leg.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Passenger name" value={waitlistName}
              onChange={(e) => setWaitlistName(e.target.value)}
              className="flex-1 rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass" />
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
          {coaches.map((coach) => (
            <CoachMap
              key={coach.coach_id}
              coach={coach}
              selectedSeats={selectedSeats}
              onToggle={toggleSeat}
            />
          ))}

          {selectedSeats.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-rail-green/15 bg-white/40 px-4 py-4">
              <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50">
                {selectedSeats.length} seat{selectedSeats.length > 1 ? "s" : ""} selected
              </p>
              {selectedSeats.map((sel) => {
                const seat = coaches.flatMap((c) => c.seats).find((s) => s.seat_id === sel.seatId);
                const fare = fareForSeat(sel.seatId, sel.fareAdult);
                return (
                  <div key={sel.seatId} className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-ink/60 w-20 shrink-0">
                      {seat ? `${seat.coach_number}-${seat.seat_number}` : sel.seatId}
                    </span>
                    <input type="text" placeholder="Passenger name"
                      value={passengerNames[sel.seatId] ?? ""}
                      onChange={(e) => setPassengerNames((p) => ({ ...p, [sel.seatId]: e.target.value }))}
                      className="flex-1 min-w-32 rounded-md border border-rail-green/25 bg-white/70 px-3 py-2 outline-none focus:border-brass text-sm" />
                    <select value={passengerTypes[sel.seatId] ?? "adult"}
                      onChange={(e) => setPassengerTypes((p) => ({ ...p, [sel.seatId]: e.target.value }))}
                      className="rounded-md border border-rail-green/25 bg-white/70 px-2 py-2 outline-none focus:border-brass text-sm">
                      {PASSENGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <span className="font-mono text-sm text-brass font-medium w-20 text-right">Rs. {fare}</span>
                    <button onClick={() => toggleSeat(sel.seatId, sel.coachClass, sel.fareAdult)}
                      className="text-ink/40 hover:text-signal-rust px-1 text-lg">×</button>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1 border-t border-rail-green/10">
                <span className="font-mono text-xs text-ink/50">
                  Total: Rs. {selectedSeats.reduce((sum, s) => sum + fareForSeat(s.seatId, s.fareAdult), 0)}
                </span>
                <button onClick={handleBookAll} disabled={submitting || !allFilled}
                  className="rounded-md bg-rail-green text-paper px-5 py-2 font-medium disabled:opacity-40 hover:bg-rail-green-dim transition-colors">
                  {submitting ? "Please wait…" : `Book ${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""}`}
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

function CoachMap({
  coach,
  selectedSeats,
  onToggle,
}: {
  coach: CoachWithSeats;
  selectedSeats: { seatId: number; coachClass: string; fareAdult: number }[];
  onToggle: (seatId: number, coachClass: string, fareAdult: number) => void;
}) {
  const styles = CLASS_STYLES[coach.class] ?? CLASS_STYLES.third;
  const layout = LAYOUT[coach.class] ?? LAYOUT.third;
  const { left, right, rows } = layout;
  const seatsPerRow = left + right;
  const availableCount = coach.seats.filter((s) => s.available).length;

  // Seat numbers go left-to-right across a row (L1, L2, | aisle | R1, R2)
  const seatRows: SeatWithStatus[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowSeats: SeatWithStatus[] = [];
    for (let col = 0; col < seatsPerRow; col++) {
      const seatIndex = r * seatsPerRow + col;
      if (seatIndex < coach.seats.length) {
        rowSeats.push(coach.seats[seatIndex]);
      }
    }
    seatRows.push(rowSeats);
  }

  return (
    <div className={`rounded-xl border px-4 py-4 ${styles.panel}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className={`font-mono text-xs font-medium uppercase tracking-wide ${styles.header}`}>
            {coach.coach_number} — {CLASS_LABELS[coach.class]}
          </span>
          <span className="ml-3 font-mono text-xs text-ink/50">{availableCount} available</span>
        </div>
        <span className={`font-mono text-sm font-medium ${styles.header}`}>from Rs. {coach.fare_adult}</span>
      </div>

      {/* Top-down coach diagram */}
      <div className="relative rounded-xl border-2 border-ink/15 bg-white/50 overflow-hidden">
        {/* Coach ends (front/back) */}
        <div className="h-6 bg-ink/10 flex items-center justify-center">
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40">Front</span>
        </div>

        {/* Seat grid with aisle */}
        <div className="px-3 py-2 flex flex-col gap-1.5">
          {/* Column headers */}
          <div
            className="grid items-center text-center"
            style={{ gridTemplateColumns: `repeat(${left}, 1fr) 16px repeat(${right}, 1fr)` }}
          >
            {Array.from({ length: left }).map((_, i) => (
              <span key={`lh-${i}`} className="font-mono text-[9px] text-ink/30 uppercase">
                {String.fromCharCode(65 + i)}
              </span>
            ))}
            <span />
            {Array.from({ length: right }).map((_, i) => (
              <span key={`rh-${i}`} className="font-mono text-[9px] text-ink/30 uppercase">
                {String.fromCharCode(65 + left + i)}
              </span>
            ))}
          </div>

          {seatRows.map((rowSeats, rowIdx) => (
            <div
              key={rowIdx}
              className="grid items-center gap-1"
              style={{ gridTemplateColumns: `repeat(${left}, 1fr) 16px repeat(${right}, 1fr)` }}
            >
              {rowSeats.slice(0, left).map((seat) => (
                <SeatButton
                  key={seat.seat_id}
                  seat={seat}
                  isSelected={selectedSeats.some((s) => s.seatId === seat.seat_id)}
                  styles={styles}
                  fareAdult={coach.fare_adult}
                  coachClass={coach.class}
                  onToggle={onToggle}
                />
              ))}
              {/* Aisle */}
              <div className="h-full flex items-center justify-center">
                <div className="w-px h-full bg-ink/10" />
              </div>
              {rowSeats.slice(left).map((seat) => (
                <SeatButton
                  key={seat.seat_id}
                  seat={seat}
                  isSelected={selectedSeats.some((s) => s.seatId === seat.seat_id)}
                  styles={styles}
                  fareAdult={coach.fare_adult}
                  coachClass={coach.class}
                  onToggle={onToggle}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="h-6 bg-ink/10 flex items-center justify-center">
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/40">Rear</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3">
        <LegendItem color="bg-white border-green-300" label="Available" />
        <LegendItem color="bg-red-100 border-red-300" label="Booked" />
        <LegendItem color={`${coach.class === 'first' ? 'bg-amber-600' : coach.class === 'second' ? 'bg-sky-700' : 'bg-emerald-700'} border-transparent`} label="Selected" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink/50">
      <span className={`inline-block w-3 h-3 rounded border ${color}`} />
      {label}
    </span>
  );
}

function SeatButton({
  seat,
  isSelected,
  styles,
  fareAdult,
  coachClass,
  onToggle,
}: {
  seat: SeatWithStatus;
  isSelected: boolean;
  styles: typeof CLASS_STYLES.first;
  fareAdult: number;
  coachClass: string;
  onToggle: (seatId: number, coachClass: string, fareAdult: number) => void;
}) {
  const tooltip = seat.available
    ? `Seat ${seat.seat_number} — available`
    : seat.blocked_origin && seat.blocked_dest
    ? `Reserved: ${seat.blocked_origin} → ${seat.blocked_dest}`
    : `Seat ${seat.seat_number} — booked`;

  return (
    <button
      onClick={() => { if (seat.available) onToggle(seat.seat_id, coachClass, fareAdult); }}
      disabled={!seat.available}
      aria-pressed={isSelected}
      title={tooltip}
      className={[
        "rounded py-1.5 font-mono text-xs border transition-colors w-full",
        isSelected
          ? styles.selected
          : seat.available
          ? styles.available
          : styles.occupied,
      ].join(" ")}
    >
      {seat.seat_number}
    </button>
  );
}

function SeatGridSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {["amber", "sky", "emerald"].map((c) => (
        <div key={c} className="rounded-xl border border-rail-green/10 bg-white/30 px-4 py-4">
          <div className="h-4 w-48 rounded bg-ink/10 mb-4" />
          <div className="h-48 rounded-xl bg-ink/5" />
        </div>
      ))}
    </div>
  );
}
