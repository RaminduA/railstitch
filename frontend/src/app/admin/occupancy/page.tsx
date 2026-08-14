"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

const TRAINS = ["Podi Menike", "Udarata Menike"];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function OccupancyPage() {
  const router = useRouter();
  type TodayCard = { tripId: number; tripName: string; direction: string; revenue: number; confirmed: number; cancelled: number };
  const [todayCards, setTodayCards] = useState<TodayCard[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [trainName, setTrainName] = useState<string | null>(null);
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<Map<string, string>>(new Map());
  const [proceeding, setProceeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlocked = useCallback(async (year: number, month: number) => {
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 2, 0).getDate();
    const to = `${year}-${String(month + 2).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    try {
      const [days, allDaysOff] = await Promise.all([
        api.getDaysOffInRange(from, to),
        api.getDaysOff().catch(() => []),
      ]);
      const reasonMap = new Map(allDaysOff.map((d) => [d.day, d.reason]));
      setBlockedDates((prev) => { const n = new Map(prev); days.forEach((d) => n.set(d, reasonMap.get(d) ?? "")); return n; });
    } catch { /* skip */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBlocked(calYear, calMonth);
  }, [calYear, calMonth, fetchBlocked]);

  const today = startOfDay(new Date());
  const todayYMD = toYMD(today);

  useEffect(() => {
    const combos = [
      { train_name: "Podi Menike",    direction: "outbound" as const },
      { train_name: "Podi Menike",    direction: "inbound"  as const },
      { train_name: "Udarata Menike", direction: "outbound" as const },
      { train_name: "Udarata Menike", direction: "inbound"  as const },
    ];
    Promise.all(
      combos.map((combo) =>
        api.findOrCreateTrip({ train_name: combo.train_name, service_date: todayYMD, direction: combo.direction })
          .then(async (trip) => {
            const s = await api.getTripSummary(trip.id);
            return {
              tripId: trip.id,
              tripName: combo.train_name,
              direction: combo.direction,
              revenue: s.total_revenue,
              confirmed: s.confirmed_bookings,
              cancelled: s.cancelled_bookings,
            } as TodayCard;
          })
          .catch(() => null),
      ),
    ).then((results) => {
      setTodayCards(results.filter(Boolean) as TodayCard[]);
      setTodayLoading(false);
    });
  }, [todayYMD]);

  function calDays(): (Date | null)[] {
    const first = new Date(calYear, calMonth, 1);
    const last = new Date(calYear, calMonth + 1, 0);
    const cells: (Date | null)[] = [];
    const offset = (first.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(calYear, calMonth, d));
    return cells;
  }

  // Admins can navigate to past months to view historical occupancy
  const canGoPrev = true;

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }

  async function handleProceed() {
    if (!trainName || !selectedDate) return;
    setProceeding(true);
    setError(null);
    try {
      const trip = await api.findOrCreateTrip({ train_name: trainName, service_date: selectedDate, direction });
      router.push(`/admin/trips/${trip.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("No service on this date.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setProceeding(false);
    }
  }

  const cells = calDays();
  const canProceed = !!trainName && !!selectedDate && !proceeding;

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-ink/50 hover:text-brass transition-colors mb-6">
          ← Dashboard
        </Link>
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-2">Department view</p>
        <h1 className="font-display text-4xl text-rail-green mb-8">Occupancy &amp; Revenue</h1>

        {/* Today summary */}
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50 mb-3">Today&apos;s services</p>
          {todayLoading ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">{[0,1,2,3].map((i) => <div key={i} className="h-20 rounded-lg bg-rail-green/10" />)}</div>
          ) : todayCards.length === 0 ? (
            <p className="font-mono text-sm text-ink/40">No trips have been created for today yet — passengers create them on first booking.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todayCards.map((card) => (
                <div key={card.tripId} className="rounded-lg border border-rail-green/15 bg-white/40 px-4 py-3">
                  <p className="font-display text-base text-rail-green">{card.tripName}</p>
                  <p className="font-mono text-xs text-ink/50 mb-2">{card.direction === "outbound" ? "Colombo Fort → Badulla" : "Badulla → Colombo Fort"}</p>
                  <div className="flex gap-4">
                    <span><p className="font-mono text-[9px] text-ink/40 uppercase">Revenue</p><p className="font-mono text-sm text-brass font-medium">Rs. {card.revenue.toLocaleString()}</p></span>
                    <span><p className="font-mono text-[9px] text-ink/40 uppercase">Confirmed</p><p className="font-mono text-sm text-rail-green font-medium">{card.confirmed}</p></span>
                    <span><p className="font-mono text-[9px] text-ink/40 uppercase">Cancelled</p><p className="font-mono text-sm text-ink/50 font-medium">{card.cancelled}</p></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 1: Train */}
        <div className="mb-6">
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-3">Select a train</p>
          <div className="grid grid-cols-2 gap-3">
            {TRAINS.map((name) => (
              <button
                key={name}
                onClick={() => setTrainName(name)}
                className={`rounded-xl border px-5 py-4 text-left transition-colors ${
                  trainName === name
                    ? "border-brass bg-brass/10 text-rail-green"
                    : "border-rail-green/15 bg-white/40 text-ink/70 hover:border-brass hover:bg-white/70"
                }`}
              >
                <span className="font-display text-lg">{name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Direction */}
        <div className="mb-6">
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-3">Direction</p>
          <div className="flex rounded-lg border border-rail-green/15 bg-white/30 p-1 w-fit">
            {(["outbound", "inbound"] as const).map((dir) => (
              <button key={dir} onClick={() => setDirection(dir)}
                className={`px-5 py-2 rounded-md font-mono text-xs uppercase tracking-wide transition-colors ${
                  direction === dir ? "bg-rail-green text-paper" : "text-ink/60 hover:text-ink"
                }`}>
                {dir === "outbound" ? "Colombo Fort → Badulla" : "Badulla → Colombo Fort"}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Date */}
        <div className="mb-6">
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-3">Select a date</p>
          <div className="rounded-xl border border-rail-green/15 bg-white/40 p-4 max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} disabled={!canGoPrev}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-rail-green/10 disabled:opacity-30 text-rail-green font-bold">‹</button>
              <span className="font-display text-base text-rail-green">{MONTHS[calMonth]} {calYear}</span>
              <button onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-rail-green/10 text-rail-green font-bold">›</button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center font-mono text-[10px] uppercase text-ink/40 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} />;
                const ymd = toYMD(date);
                const isBlocked = blockedDates.has(ymd);
                const blockReason = blockedDates.get(ymd);
                const isSelected = selectedDate === ymd;
                const isToday = toYMD(today) === ymd;
                // Admins can select past dates
                const disabled = isBlocked;
                return (
                  <button key={ymd} onClick={() => { if (!disabled) setSelectedDate(ymd); }}
                    disabled={disabled}
                    title={isBlocked ? (blockReason ? `No service: ${blockReason}` : "No service on this date") : undefined}
                    className={[
                      "rounded-md py-1.5 font-mono text-sm transition-colors w-full",
                      isSelected ? "bg-rail-green text-paper font-medium"
                        : isToday ? "border border-brass text-rail-green hover:bg-brass/10"
                        : disabled ? "text-ink/25 line-through cursor-not-allowed"
                        : "text-ink/70 hover:bg-rail-green/10 hover:text-rail-green",
                    ].join(" ")}>
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
          {selectedDate && (
            <p className="mt-2 font-mono text-xs text-ink/50">
              Selected:{" "}
              <span className="text-rail-green font-medium">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })}
              </span>
            </p>
          )}
        </div>

        {error && <p className="text-signal-rust text-sm mb-4">{error}</p>}

        <button onClick={handleProceed} disabled={!canProceed}
          className="rounded-lg bg-rail-green text-paper px-8 py-3 font-display text-lg disabled:opacity-40 hover:bg-rail-green-dim transition-colors">
          {proceeding ? "Loading…" : "View occupancy & revenue →"}
        </button>
      </div>
    </main>
  );
}
