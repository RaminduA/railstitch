"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import {
  api,
  type AvailabilityResponse,
  type Booking,
  type CoachWithSeats,
  type SeatWithStatus,
  type FareCell,
} from "@/lib/api";
import type { AppUser } from "@/lib/auth";

type Props = { tripId: number; originId: number; destId: number };

const CLASS_LABELS: Record<string, string> = {
  first:  "1st Class — Air Conditioned",
  second: "2nd Class — Reserved",
  third:  "3rd Class — Reserved",
};
const CLASS_MULT: Record<string, string> = { first: "3×", second: "1.8×", third: "1×" };
const PTYPE_MULT: Record<string, string> = { adult: "1×", child: "0.5×", student: "0.7×", senior: "0.75×" };
const PTYPES = ["adult", "child", "student", "senior"] as const;

const STYLES: Record<string, Record<string, string>> = {
  first:  { panel: "bg-amber-50/80 border-amber-200",   hdr: "text-amber-900", avail: "bg-white border-amber-300 hover:border-amber-500 text-amber-800",     sel: "bg-amber-600 border-amber-600 text-white",     occ: "bg-red-100 border-red-200 text-red-400 cursor-not-allowed" },
  second: { panel: "bg-sky-50/80 border-sky-200",       hdr: "text-sky-900",   avail: "bg-white border-sky-300 hover:border-sky-500 text-sky-800",             sel: "bg-sky-700 border-sky-700 text-white",         occ: "bg-red-100 border-red-200 text-red-400 cursor-not-allowed" },
  third:  { panel: "bg-emerald-50/80 border-emerald-200", hdr: "text-emerald-900", avail: "bg-white border-emerald-300 hover:border-emerald-500 text-emerald-800", sel: "bg-emerald-700 border-emerald-700 text-white", occ: "bg-red-100 border-red-200 text-red-400 cursor-not-allowed" },
};
const LAYOUT: Record<string, { left: number; right: number; rows: number }> = {
  first: { left: 2, right: 2, rows: 11 },
  second: { left: 2, right: 2, rows: 12 },
  third: { left: 3, right: 3, rows: 11 },
};

type Sel = { seatId: number; coachClass: string };
type Suggested = { seatId: number; seatNum: number; coachClass: string } | null;

export function SeatPicker({ tripId, originId, destId }: Props) {
  const { data: session } = useSession();
  const user = session?.user as AppUser | undefined;

  const [loading, setLoading] = useState(true);
  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [fares, setFares] = useState<FareCell[]>([]);
  const [selected, setSelected] = useState<Sel[]>([]);
  const [ptypes, setPtypes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [waitlisted, setWaitlisted] = useState<{ pos: number; cls: string } | null>(null);
  const [suggested, setSuggested] = useState<Suggested>(null);

  useEffect(() => {
    let gone = false;
    Promise.all([
      api.getAvailability(tripId, originId, destId),
      api.getFareTable(tripId, originId, destId),
    ]).then(([a, f]) => {
      if (!gone) { setAvail(a); setFares(f); setLoading(false); }
    }).catch(() => { if (!gone) setLoading(false); });
    return () => { gone = true; };
  }, [tripId, originId, destId]);

  async function reload() {
    const a = await api.getAvailability(tripId, originId, destId);
    setAvail(a);
  }

  function toggle(seatId: number, cls: string) {
    setSelected((prev) => {
      if (prev.find((s) => s.seatId === seatId)) {
        setPtypes((p) => { const c = { ...p }; delete c[seatId]; return c; });
        return prev.filter((s) => s.seatId !== seatId);
      }
      return [...prev, { seatId, coachClass: cls }];
    });
  }

  function fare(seatId: number, cls: string) {
    const pt = ptypes[seatId] ?? "adult";
    return fares.find((f) => f.class === cls && f.passenger_type === pt)?.fare ?? 0;
  }

  function nextAvailable(takenId: number, cls: string): Suggested {
    const coach = avail?.coaches.find((c) => c.class === cls && c.seats.some((s) => s.seat_id === takenId));
    const next = coach?.seats.find((s) => s.available && s.seat_id !== takenId);
    if (!next || !coach) return null;
    return { seatId: next.seat_id, seatNum: next.seat_number, coachClass: cls };
  }

  async function book() {
    if (!session) {
      sessionStorage.setItem("railstitch:booking", JSON.stringify({ tripId, originId, destId, selected, ptypes }));
      signIn("google", { callbackUrl: `/trips/${tripId}` });
      return;
    }
    if (selected.length === 0) return;
    setBusy(true); setError(null); setSuggested(null);

    const results = await Promise.allSettled(
      selected.map((s) =>
        api.createBooking(tripId, {
          origin_station_id: originId,
          dest_station_id: destId,
          passenger_type: ptypes[s.seatId] ?? "adult",
          seat_id: s.seatId,
          class: s.coachClass,
          user_id: user?.googleId,
        }),
      ),
    );

    const ok: Booking[] = [];
    const fail: Sel[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") ok.push(r.value);
      else fail.push(selected[i]);
    });
    if (ok.length) setConfirmed((p) => [...p, ...ok]);
    await reload();

    if (fail.length) {
      const sugg = nextAvailable(fail[0].seatId, fail[0].coachClass);
      if (sugg) {
        setSuggested(sugg);
        setSelected([{ seatId: sugg.seatId, coachClass: sugg.coachClass }]);
        setPtypes({ [sugg.seatId]: ptypes[fail[0].seatId] ?? "adult" });
      } else {
        setSelected([]);
        setError("no-seats");
      }
    } else {
      setSelected([]); setPtypes({});
    }
    setBusy(false);
  }

  async function joinWaitlist(cls: string) {
    setBusy(true);
    try {
      const r = await api.createWaitlistEntry(tripId, {
        origin_station_id: originId,
        dest_station_id: destId,
        class: cls,
        user_id: user?.googleId,
      });
      setWaitlisted({ pos: r.queue_position, cls });
    } catch {
      setError("Failed to join waitlist.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton />;

  const coaches = avail?.coaches ?? [];
  const totalAvail = coaches.reduce((n, c) => n + c.seats.filter((s) => s.available).length, 0);

  return (
    <div className="flex flex-col gap-5">

      {/* Fare table */}
      {fares.length > 0 && <FareTableView fares={fares} />}

      {/* Confirmed */}
      {confirmed.map((b) => (
        <div key={b.id} className="rounded-xl border-2 border-brass bg-white/60 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-brass mb-1">Booking confirmed</p>
          <p className="font-display text-xl text-rail-green">{b.coach_number}, Seat {b.seat_number}</p>
          <p className="text-ink/70 text-sm">{b.origin_name} → {b.dest_name} · {b.passenger_type}</p>
          <p className="font-mono text-xs text-ink/50 mt-1">Rs. {b.fare.toFixed(0)} · #{b.id}</p>
          <Link href={`/bookings/${b.id}`}
            className="inline-block mt-3 rounded-md bg-rail-green text-paper px-4 py-1.5 font-mono text-xs hover:opacity-80 transition-opacity">
            View &amp; print ticket →
          </Link>
          <p className="font-mono text-[10px] text-ink/40 mt-1">Find your tickets anytime under Booking History.</p>
        </div>
      ))}

      {/* Race-loss suggestion */}
      {suggested && (
        <div className="rounded-xl border-2 border-brass/50 bg-white/60 px-5 py-4">
          <p className="font-mono text-xs uppercase tracking-wide text-brass mb-1">Seat just taken</p>
          <p className="text-ink/80 text-sm mb-3">
            We found <strong>Seat {suggested.seatNum}</strong> in the same coach — confirm instead?
          </p>
          <div className="flex gap-2">
            <button onClick={book} disabled={busy}
              className="rounded-md bg-rail-green text-paper px-4 py-2 font-mono text-xs disabled:opacity-40 hover:opacity-80">
              {busy ? "Booking…" : `Confirm Seat ${suggested.seatNum}`}
            </button>
            <button onClick={() => { setSuggested(null); setSelected([]); }}
              className="rounded-md border border-ink/20 text-ink/60 px-4 py-2 font-mono text-xs hover:border-signal-rust hover:text-signal-rust">
              Choose differently
            </button>
          </div>
        </div>
      )}

      {/* Waitlist result */}
      {waitlisted && (
        <div className="rounded-xl border border-brass/40 bg-white/40 px-5 py-4">
          <p className="font-display text-lg text-rail-green mb-1">You&apos;re on the waitlist</p>
          <p className="font-mono text-sm text-ink/70">
            You&apos;re <strong>#{waitlisted.pos}</strong> in line for {CLASS_LABELS[waitlisted.cls]}.
          </p>
          <p className="font-mono text-xs text-ink/40 mt-1">Your seat will be confirmed automatically if one becomes available.</p>
        </div>
      )}

      {/* No seats error — show waitlist CTA */}
      {error === "no-seats" && !waitlisted && (
        <div className="rounded-xl border border-signal-rust/30 bg-white/40 px-5 py-4">
          <p className="text-ink/80 mb-3">No seats available in that class. Join the waitlist?</p>
          <div className="flex gap-2 flex-wrap">
            {coaches.map((c) => (
              <button key={c.coach_id} onClick={() => joinWaitlist(c.class)} disabled={busy}
                className="rounded-md bg-rail-green text-paper px-4 py-2 font-mono text-xs disabled:opacity-40 hover:opacity-80">
                {CLASS_LABELS[c.class]}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && error !== "no-seats" && <p className="text-signal-rust text-sm">{error}</p>}

      {/* All seats taken — show waitlist upfront */}
      {totalAvail === 0 && !waitlisted && !suggested && confirmed.length === 0 && (
        <div className="rounded-xl border border-signal-rust/30 bg-white/40 px-5 py-4">
          <p className="text-ink/80 mb-3">No reserved seats are free for this leg. Join the waitlist by class:</p>
          <div className="flex gap-2 flex-wrap">
            {coaches.map((c) => (
              <button key={c.coach_id} onClick={() => joinWaitlist(c.class)} disabled={busy}
                className="rounded-md bg-rail-green text-paper px-4 py-2 font-mono text-xs disabled:opacity-40 hover:opacity-80">
                {CLASS_LABELS[c.class]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coach maps */}
      {totalAvail > 0 && !suggested && coaches.map((coach) => (
        <CoachPanel key={coach.coach_id} coach={coach} selected={selected} onToggle={toggle} />
      ))}

      {/* Booking summary */}
      {selected.length > 0 && !suggested && (
        <div className="rounded-xl border border-rail-green/15 bg-white/40 px-5 py-4 flex flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">{selected.length} seat{selected.length > 1 ? "s" : ""} selected</p>
          {selected.map((sel) => {
            const seat = coaches.flatMap((c) => c.seats).find((s) => s.seat_id === sel.seatId);
            return (
              <div key={sel.seatId} className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs text-ink/60 w-16 shrink-0">{seat ? `${seat.coach_number}-${seat.seat_number}` : `#${sel.seatId}`}</span>
                <select value={ptypes[sel.seatId] ?? "adult"}
                  onChange={(e) => setPtypes((p) => ({ ...p, [sel.seatId]: e.target.value }))}
                  className="rounded-md border border-rail-green/20 bg-white/70 px-2 py-1.5 text-sm outline-none focus:border-brass">
                  {PTYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <span className="font-mono text-sm text-brass font-medium">Rs. {fare(sel.seatId, sel.coachClass)}</span>
                <button onClick={() => toggle(sel.seatId, sel.coachClass)} className="text-ink/30 hover:text-signal-rust text-xl ml-auto">×</button>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-2 border-t border-rail-green/10">
            <span className="font-mono text-xs text-ink/50">Total: Rs. {selected.reduce((s, x) => s + fare(x.seatId, x.coachClass), 0)}</span>
            <button onClick={book} disabled={busy}
              className="rounded-md bg-rail-green text-paper px-5 py-2 font-medium disabled:opacity-40 hover:opacity-80 transition-opacity">
              {busy ? "Please wait…" : session ? `Book ${selected.length} seat${selected.length > 1 ? "s" : ""}` : "Sign in to book"}
            </button>
          </div>
          {!session && (
            <p className="font-mono text-[10px] text-ink/40 text-right">Sign in with Google to complete — your selections are saved.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FareTableView({ fares }: { fares: FareCell[] }) {
  const classes = ["first", "second", "third"] as const;
  const getF = (cls: string, pt: string) => fares.find((f) => f.class === cls && f.passenger_type === pt)?.fare;
  return (
    <div className="rounded-xl border border-rail-green/15 bg-white/40 overflow-hidden">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50 px-4 pt-3 pb-1">Fares for this leg</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-rail-green/10">
              <th className="text-left px-4 py-2 font-mono text-[10px] text-ink/40 uppercase">Class</th>
              {PTYPES.map((pt) => (
                <th key={pt} className="text-right px-3 py-2 font-mono text-[10px] text-ink/40 uppercase">
                  {pt.charAt(0).toUpperCase() + pt.slice(1)}<br/>
                  <span className="text-ink/20 normal-case">{PTYPE_MULT[pt]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls} className="border-b border-rail-green/5 last:border-0">
                <td className="px-4 py-2 text-ink/70">
                  {CLASS_LABELS[cls]}<br/>
                  <span className="font-mono text-[10px] text-ink/30">{CLASS_MULT[cls]}</span>
                </td>
                {PTYPES.map((pt) => (
                  <td key={pt} className="text-right px-3 py-2 font-mono text-ink/80">
                    {getF(cls, pt) !== undefined ? `Rs. ${getF(cls, pt)}` : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[9px] text-ink/30 px-4 pb-2 pt-1">Includes demand and time adjustments at current moment.</p>
    </div>
  );
}

function CoachPanel({ coach, selected, onToggle }: {
  coach: CoachWithSeats;
  selected: Sel[];
  onToggle: (id: number, cls: string) => void;
}) {
  const st = STYLES[coach.class] ?? STYLES.third;
  const { left, right, rows } = LAYOUT[coach.class] ?? LAYOUT.third;
  const seatsPerRow = left + right;
  const avail = coach.seats.filter((s) => s.available).length;
  const w = coach.class === "third" ? 88 : 132;

  const grid: SeatWithStatus[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: SeatWithStatus[] = [];
    for (let c = 0; c < seatsPerRow; c++) {
      const seat = coach.seats[r * seatsPerRow + c];
      if (seat) row.push(seat);
    }
    grid.push(row);
  }

  return (
    <div className={`rounded-xl border px-4 py-4 ${st.panel}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`font-mono text-xs font-medium uppercase tracking-wide ${st.hdr}`}>
          {coach.coach_number} — {CLASS_LABELS[coach.class]}
          <span className="ml-2 font-normal text-ink/40 normal-case">{avail} seats available</span>
        </span>
        <span className={`font-mono text-sm font-medium ${st.hdr}`}>from Rs. {coach.fare_adult}</span>
      </div>
      <div className="rounded-xl border-2 border-ink/10 bg-white/50 overflow-hidden">
        <div className="h-6 bg-ink/[0.06] flex items-center justify-center">
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/30">Front</span>
        </div>
        <div className="px-3 py-2 flex flex-col gap-1">
          {/* Column headers */}
          <div className="grid w-full"
            style={{ gridTemplateColumns: `repeat(${left}, ${w}px) 1fr repeat(${right}, ${w}px)` }}>
            {Array.from({ length: left }).map((_, i) => (
              <span key={i} className="text-center font-mono text-[9px] text-ink/25">{String.fromCharCode(65 + i)}</span>
            ))}
            <span />
            {Array.from({ length: right }).map((_, i) => (
              <span key={i} className="text-center font-mono text-[9px] text-ink/25">{String.fromCharCode(65 + left + i)}</span>
            ))}
          </div>
          {/* Seat rows */}
          {grid.map((row, ri) => (
            <div key={ri} className="grid w-full items-center gap-1"
              style={{ gridTemplateColumns: `repeat(${left}, ${w}px) 1fr repeat(${right}, ${w}px)` }}>
              {row.slice(0, left).map((seat) => (
                <Btn key={seat.seat_id} seat={seat} sel={selected.some((s) => s.seatId === seat.seat_id)} cls={coach.class} st={st} onToggle={onToggle} />
              ))}
              <div className="self-stretch border-l border-r border-ink/10 bg-ink/[0.02]" />
              {row.slice(left).map((seat) => (
                <Btn key={seat.seat_id} seat={seat} sel={selected.some((s) => s.seatId === seat.seat_id)} cls={coach.class} st={st} onToggle={onToggle} />
              ))}
            </div>
          ))}
        </div>
        <div className="h-6 bg-ink/[0.06] flex items-center justify-center">
          <span className="font-mono text-[9px] uppercase tracking-widest text-ink/30">Rear</span>
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-4 mt-2">
        {[
          { bg: "bg-white border-gray-300", label: "Available" },
          { bg: "bg-red-100 border-red-200", label: "Booked" },
          { bg: `${coach.class === "first" ? "bg-amber-600" : coach.class === "second" ? "bg-sky-700" : "bg-emerald-700"} border-transparent`, label: "Selected" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 font-mono text-[9px] text-ink/40">
            <span className={`inline-block w-3 h-3 rounded border ${l.bg}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Btn({ seat, sel, cls, st, onToggle }: {
  seat: SeatWithStatus; sel: boolean; cls: string;
  st: Record<string, string>; onToggle: (id: number, cls: string) => void;
}) {
  const tip = !seat.available && seat.blocked_origin && seat.blocked_dest
    ? `Reserved: ${seat.blocked_origin} → ${seat.blocked_dest}`
    : !seat.available ? `Seat ${seat.seat_number} — booked` : `Seat ${seat.seat_number}`;
  return (
    <button onClick={() => { if (seat.available) onToggle(seat.seat_id, cls); }}
      disabled={!seat.available} title={tip}
      className={`rounded py-2 font-mono text-xs border w-full transition-colors ${
        sel ? st.sel : seat.available ? st.avail : st.occ
      }`}>
      {seat.seat_number}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-28 rounded-xl bg-white/40 border border-rail-green/10" />
      {["amber", "sky", "emerald"].map((c) => (
        <div key={c} className="rounded-xl border border-rail-green/10 bg-white/30 px-4 py-4">
          <div className="h-4 w-40 rounded bg-ink/10 mb-4" />
          <div className="h-52 rounded-xl bg-ink/5" />
        </div>
      ))}
    </div>
  );
}
