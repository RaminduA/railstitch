"use client";

import { useEffect, useRef, useState } from "react";
import type { Station, TripStop } from "@/lib/api";

type Props = {
  stations: Station[];
  stops: TripStop[];
  selectedIds: number[];
  direction: "outbound" | "inbound";
  serviceDate: string;
  tripId?: number;
  onSelect: (stationId: number) => void;
};

const ZONE_COLORS: Record<number, string> = {
  1: "#4A7C6F",
  2: "#C08A2E",
  3: "#7B5EA7",
  4: "#C0574A",
  5: "#2E6EA6",
};

const TRACK_Y = 60;
const SVG_H = 170;
const PAD = 48;
const MIN_GAP = 22;
const TRACK_W = 1100;

enum TrackingStrategy { Schedule = "schedule", LiveFeed = "live_feed" }
const TRACKING_STRATEGY = TrackingStrategy.Schedule;

function computePassedStations_Schedule(stops: TripStop[], serviceDate: string): Set<number> {
  const now = new Date();
  const todayYMD = now.toISOString().slice(0, 10);
  if (serviceDate !== todayYMD) return new Set();
  const passed = new Set<number>();
  for (const s of stops) {
    if (!s.departure_time) continue;
    const [h, m] = s.departure_time.split(":").map(Number);
    const dep = new Date(serviceDate + "T00:00:00");
    dep.setHours(h, m, 0, 0);
    if (now > dep) passed.add(s.station_id);
  }
  return passed;
}

function computePassedStations_LiveFeed(
  _stops: TripStop[],
  _serviceDate: string,
  _tripId: number,
  onUpdate: (stationId: number) => void,
): () => void {
  const ws = new WebSocket(`ws://localhost:8080/api/trips/${_tripId}/live`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data) as { trip_id: number; station_id: number; station_name: string; departed_at: string };
    onUpdate(msg.station_id);
  };
  ws.onerror = (err) => console.warn("Live feed error:", err);
  return () => ws.close();
}

export function RouteRail({ stations, stops, selectedIds, direction, serviceDate, tripId, onSelect }: Props) {
  const [passed, setPassed] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [focusField, setFocusField] = useState<"from" | "to" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (TRACKING_STRATEGY === TrackingStrategy.Schedule) {
      const update = () => setPassed(computePassedStations_Schedule(stops, serviceDate));
      update();
      const id = setInterval(update, 30_000);
      return () => clearInterval(id);
    }
    if (TRACKING_STRATEGY === TrackingStrategy.LiveFeed && tripId) {
      const cleanup = computePassedStations_LiveFeed(stops, serviceDate, tripId, (sid) =>
        setPassed((p) => new Set([...p, sid])),
      );
      return cleanup;
    }
  }, [stops, serviceDate, tripId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stations]);

  if (stations.length === 0) return null;

  const stopIds = new Set(stops.map((s) => s.station_id));
  const stopByStationId = new Map(stops.map((s) => [s.station_id, s]));
  const boardable = new Set(stops.filter((s) => s.can_board && !passed.has(s.station_id)).map((s) => s.station_id));

  const display = direction === "inbound" ? [...stations].reverse() : stations;
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  let originId: number | null = null;
  let destId: number | null = null;
  if (selectedIds.length === 2) {
    const [a, b] = selectedIds;
    const sa = stationMap.get(a)?.seq ?? 0;
    const sb = stationMap.get(b)?.seq ?? 0;
    if (direction === "outbound") { originId = sa <= sb ? a : b; destId = sa <= sb ? b : a; }
    else { originId = sa >= sb ? a : b; destId = sa >= sb ? b : a; }
  } else if (selectedIds.length === 1) originId = selectedIds[0];

  // Compute x positions
  const dists = display.map((s) => s.distance_km);
  const dMin = Math.min(...dists), dMax = Math.max(...dists);
  const range = dMax - dMin;
  const xs: number[] = [];
  let prev = -Infinity;
  for (const s of display) {
    const frac = range > 0 ? (s.distance_km - dMin) / range : 0;
    let x = PAD + frac * TRACK_W;
    if (x < prev + MIN_GAP) x = prev + MIN_GAP;
    xs.push(x);
    prev = x;
  }
  const totalW = xs[xs.length - 1] + PAD;
  const xById = new Map(display.map((s, i) => [s.id, xs[i]]));
  const segX1 = originId !== null ? (xById.get(originId) ?? null) : null;
  const segX2 = destId !== null ? (xById.get(destId) ?? null) : null;

  // Typeahead filtering
  const fromQuery = query.from.toLowerCase().trim();
  const toQuery = query.to.toLowerCase().trim();
  const eligible = stops.filter((s) => s.can_board && !passed.has(s.station_id));
  const fromSuggestions = fromQuery.length > 0
    ? eligible.filter((s) => (stationMap.get(s.station_id)?.name ?? "").toLowerCase().includes(fromQuery)).slice(0, 6)
    : [];
  const toSuggestions = toQuery.length > 0
    ? eligible.filter((s) => (stationMap.get(s.station_id)?.name ?? "").toLowerCase().includes(toQuery)).slice(0, 6)
    : [];

  function handleTypeaheadSelect(stationId: number, field: "from" | "to") {
    const name = stationMap.get(stationId)?.name ?? "";
    if (field === "from") setQuery((q) => ({ ...q, from: name }));
    else setQuery((q) => ({ ...q, to: name }));
    setFocusField(null);
    onSelect(stationId);
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Typeahead search */}
      <div className="flex gap-3 flex-col sm:flex-row">
        {(["from", "to"] as const).map((field) => {
          const label = field === "from" ? "From" : "To";
          const suggestions = field === "from" ? fromSuggestions : toSuggestions;
          const selName = field === "from"
            ? (originId ? stationMap.get(originId)?.name : undefined)
            : (destId ? stationMap.get(destId)?.name : undefined);
          return (
            <div key={field} className="relative flex-1">
              <label className="font-mono text-[10px] uppercase tracking-wide text-ink/50 mb-1 block">{label}</label>
              <input
                type="text"
                value={focusField === field ? query[field] : (selName ?? query[field])}
                placeholder={`Type station name…`}
                onFocus={() => { setFocusField(field); setQuery((q) => ({ ...q, [field]: selName ?? "" })); }}
                onBlur={() => setTimeout(() => setFocusField(null), 150)}
                onChange={(e) => setQuery((q) => ({ ...q, [field]: e.target.value }))}
                className="w-full rounded-lg border border-rail-green/25 bg-white/70 px-3 py-2 text-sm outline-none focus:border-brass transition-colors"
              />
              {focusField === field && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-rail-green/20 bg-paper shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button key={s.station_id} onMouseDown={() => handleTypeaheadSelect(s.station_id, field)}
                      className="w-full text-left px-3 py-2 font-mono text-sm text-ink/80 hover:bg-rail-green/10 transition-colors">
                      {stationMap.get(s.station_id)?.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Route Rail diagram */}
      <div ref={scrollRef} className="overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <style>{`.rail-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div className="rail-scroll">
          <svg
            viewBox={`0 0 ${totalW} ${SVG_H}`}
            width={totalW}
            height={SVG_H}
            className="select-none"
            role="group"
            aria-label="Route diagram"
          >
            {/* Base track */}
            <line x1={PAD} y1={TRACK_Y} x2={totalW - PAD} y2={TRACK_Y}
              stroke="#1F3B2C" strokeOpacity={0.15} strokeWidth={3} strokeLinecap="round" />

            {/* Selected segment */}
            {segX1 !== null && segX2 !== null && (
              <line x1={Math.min(segX1, segX2)} y1={TRACK_Y} x2={Math.max(segX1, segX2)} y2={TRACK_Y}
                stroke="#C08A2E" strokeWidth={5} strokeLinecap="round" />
            )}

            {display.map((s, i) => {
              const x = xs[i];
              const isStop = stopIds.has(s.id);
              const isPassed = passed.has(s.id);
              const canBoard = boardable.has(s.id);
              const isSelected = selectedIds.includes(s.id);
              const isOrigin = s.id === originId;
              const isDest = s.id === destId;
              const clickable = isStop && canBoard;
              const stop = stopByStationId.get(s.id);

              const depTime = stop?.departure_time ?? null;
              const tip = !isStop
                ? "This train does not stop at this station"
                : isPassed && depTime
                ? `Departed at ${depTime}`
                : isPassed
                ? "Train has already departed"
                : isSelected ? s.name
                : `Select ${s.name}`;

              return (
                <g key={s.id}
                  onClick={() => { if (clickable) onSelect(s.id); }}
                  style={{ cursor: clickable ? "pointer" : "default" }}
                  role={clickable ? "button" : "presentation"}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={(e) => { if (clickable && (e.key === "Enter" || e.key === " ")) onSelect(s.id); }}
                  aria-pressed={isSelected}
                  aria-disabled={!clickable}
                >
                  <title>{tip}</title>
                  {/* Hit area */}
                  <circle cx={x} cy={TRACK_Y} r={18} fill="transparent" />
                  {/* Outer ring for selected */}
                  {(isOrigin || isDest) && (
                    <circle cx={x} cy={TRACK_Y} r={14}
                      fill="transparent" stroke="#C08A2E" strokeWidth={1.5}
                      strokeDasharray={isDest ? "3 2" : "none"} />
                  )}
                  {/* Main dot */}
                  <circle cx={x} cy={TRACK_Y}
                    r={isSelected ? 9 : isStop ? 6 : 3}
                    fill={isSelected ? "#C08A2E" : isPassed ? "#B8AA96" : isStop ? (ZONE_COLORS[s.zone] ?? "#4A7C6F") : "#C8BAA0"}
                    stroke={isSelected ? "#1F3B2C" : isStop && !isPassed ? "#1F3B2C" : "transparent"}
                    strokeWidth={isSelected ? 2 : 1.5}
                    opacity={isPassed ? 0.5 : !isStop ? 0.35 : 1}
                  />
                  {/* Station label */}
                  {isStop && (
                    <g transform={`translate(${x} ${TRACK_Y + 20}) rotate(-40)`}>
                      <text x={0} y={0} textAnchor="end"
                        fontSize={isSelected ? 11 : 10}
                        fontFamily="var(--font-plex-mono), monospace"
                        fill={isSelected ? "#1F3B2C" : isPassed ? "#A09078" : "#23201Baa"}
                        fontWeight={isSelected ? "600" : "400"}>
                        {isPassed ? `${s.name} ✓` : s.name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Overflow hint */}
      {overflows && (
        <p className="font-mono text-[10px] text-ink/40 text-center">← scroll sideways to see all stations →</p>
      )}

      {/* Zone legend */}
      <div className="flex gap-3 flex-wrap px-1">
        {[1, 2, 3, 4, 5].map((z) => (
          <span key={z} className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-ink/40">
            <span style={{ background: ZONE_COLORS[z] }} className="inline-block w-2 h-2 rounded-full" />Zone {z}
          </span>
        ))}
        <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-ink/40">
          <span className="inline-block w-2 h-2 rounded-full bg-ink/20" />Passed
        </span>
      </div>
    </div>
  );
}
