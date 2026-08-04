"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { TripStop } from "@/lib/api";
import { api, ApiError } from "@/lib/api";

type Props = {
  trainName: string;
  outboundStops: TripStop[];
  inboundStops: TripStop[];
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function TrainPageClient({ trainName, outboundStops, inboundStops }: Props) {
  const router = useRouter();
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [proceeding, setProceeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStops = direction === "outbound" ? outboundStops : inboundStops;

  // Fetch blocked dates for the visible calendar month (+ next month buffer)
  const fetchBlocked = useCallback(async (year: number, month: number) => {
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 2, 0).getDate();
    const to = `${year}-${String(month + 2).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    try {
      const days = await api.getDaysOffInRange(from, to);
      setBlockedDates((prev) => {
        const next = new Set(prev);
        days.forEach((d) => next.add(d));
        return next;
      });
    } catch {
      // Non-critical — just don't block anything if the fetch fails
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBlocked(calYear, calMonth);
  }, [calYear, calMonth, fetchBlocked]);

  const today = startOfDay(new Date());

  function calDays(): (Date | null)[] {
    const first = new Date(calYear, calMonth, 1);
    const last = new Date(calYear, calMonth + 1, 0);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(calYear, calMonth, d));
    return cells;
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }

  // Prevent navigating to months entirely in the past
  const canGoPrev = calYear > today.getFullYear() ||
    (calYear === today.getFullYear() && calMonth > today.getMonth());

  async function handleProceed() {
    if (!selectedDate) return;
    setProceeding(true);
    setError(null);
    try {
      const trip = await api.findOrCreateTrip({
        train_name: trainName,
        service_date: selectedDate,
        direction,
      });
      router.push(`/trips/${trip.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("No service on this date. Please choose another day.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setProceeding(false);
    }
  }

  const cells = calDays();

  return (
    <div className="flex flex-col gap-6">
      {/* Direction toggle */}
      <div className="flex rounded-lg border border-rail-green/15 bg-white/30 p-1 w-fit">
        {(["outbound", "inbound"] as const).map((dir) => (
          <button
            key={dir}
            onClick={() => { setDirection(dir); setSelectedDate(null); }}
            className={`px-5 py-2 rounded-md font-mono text-xs uppercase tracking-wide transition-colors ${
              direction === dir
                ? "bg-rail-green text-paper"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            {dir === "outbound" ? "Colombo Fort → Badulla" : "Badulla → Colombo Fort"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timetable */}
        <div className="rounded-xl border border-rail-green/15 bg-white/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-rail-green/10">
            <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50">Timetable</p>
            <p className="font-display text-lg text-rail-green mt-0.5">
              {direction === "outbound" ? "Colombo Fort → Badulla" : "Badulla → Colombo Fort"}
            </p>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white/80 backdrop-blur border-b border-rail-green/10">
                <tr>
                  <th className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">Station</th>
                  <th className="text-right px-5 py-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">Arr</th>
                  <th className="text-right px-5 py-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">Dep</th>
                </tr>
              </thead>
              <tbody>
                {currentStops.map((stop, i) => (
                  <tr key={stop.id} className={`border-b border-rail-green/5 ${
                    i === 0 || i === currentStops.length - 1 ? "bg-rail-green/5" : ""
                  }`}>
                    <td className="px-5 py-2 text-ink/80">
                      {stop.station_name}
                      {(i === 0 || i === currentStops.length - 1) && (
                        <span className="ml-2 font-mono text-[9px] uppercase text-ink/40">
                          {i === 0 ? "origin" : "terminus"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right font-mono text-xs text-ink/50">{stop.arrival_time ?? "—"}</td>
                    <td className="px-5 py-2 text-right font-mono text-xs text-ink/70">{stop.departure_time ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Date picker */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-1">Choose a date</p>
            <p className="font-display text-lg text-rail-green">Select your travel date</p>
          </div>

          <div className="rounded-xl border border-rail-green/15 bg-white/40 p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                disabled={!canGoPrev}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-rail-green/10 disabled:opacity-30 text-rail-green font-bold"
              >
                ‹
              </button>
              <span className="font-display text-base text-rail-green">
                {MONTHS[calMonth]} {calYear}
              </span>
              <button
                onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-rail-green/10 text-rail-green font-bold"
              >
                ›
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center font-mono text-[10px] uppercase text-ink/40 py-1">{d}</div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} />;
                const ymd = toYMD(date);
                const isPast = startOfDay(date) < today;
                const isBlocked = blockedDates.has(ymd);
                const isSelected = selectedDate === ymd;
                const isToday = toYMD(today) === ymd;
                const disabled = isPast || isBlocked;
                return (
                  <button
                    key={ymd}
                    onClick={() => { if (!disabled) setSelectedDate(ymd); }}
                    disabled={disabled}
                    title={isBlocked ? "No service on this date" : undefined}
                    className={[
                      "rounded-md py-2 font-mono text-sm transition-colors w-full",
                      isSelected
                        ? "bg-rail-green text-paper font-medium"
                        : isToday && !disabled
                        ? "border border-brass text-rail-green hover:bg-brass/10"
                        : disabled
                        ? "text-ink/25 line-through cursor-not-allowed"
                        : "text-ink/70 hover:bg-rail-green/10 hover:text-rail-green",
                    ].join(" ")}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="rounded-lg border border-brass/40 bg-white/40 px-4 py-3 text-sm">
              <span className="font-mono text-xs text-ink/50 uppercase tracking-wide">Selected — </span>
              <span className="text-rail-green font-medium">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })}
              </span>
            </div>
          )}

          {error && <p className="text-signal-rust text-sm">{error}</p>}

          <button
            onClick={handleProceed}
            disabled={!selectedDate || proceeding}
            className="w-full rounded-lg bg-rail-green text-paper py-3 font-display text-lg disabled:opacity-40 hover:bg-rail-green-dim transition-colors"
          >
            {proceeding ? "Please wait…" : "Proceed to seat selection →"}
          </button>
        </div>
      </div>
    </div>
  );
}
