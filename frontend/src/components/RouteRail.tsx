"use client";

import { useState, useEffect } from "react";
import type { Station, TripStop } from "@/lib/api";

type Props = {
  stations: Station[];
  stops: TripStop[];
  selectedIds: number[];
  direction: "outbound" | "inbound";
  serviceDate: string;
  tripId: number;
  onSelect: (stationId: number) => void;
};

const ZONE_COLORS: Record<number, string> = {
  1: "#4A7C6F",  // Deep teal: coastal lowlands
  2: "#C08A2E",  // Brass: transitional hill country  
  3: "#7B5EA7",  // Muted violet: mid-elevation
  4: "#C0574A",  // Terracotta: high plateau
  5: "#2E6EA6",  // Steel blue: Badulla descent
};

const TRACK_Y = 56;
const HEIGHT = 160;

enum TrackingStrategy {
  Schedule = "schedule",
  LiveFeed = "live_feed",
}

const TRACKING_STRATEGY = TrackingStrategy.Schedule;

// Strategy 1: Schedule-based
// Compares current wall clock time against scheduled departure times
// Accurate for on time trains. Inaccurate when trains run late (common in SLR)
function computePassedStations_Schedule(stops: TripStop[], serviceDate: string): Set<number> {
  const today = new Date();
  const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (serviceDate !== todayYMD) return new Set();

  const passed = new Set<number>();
  for (const stop of stops) {
    if (!stop.departure_time) continue;
    const [h, m] = stop.departure_time.split(":").map(Number);
    const depTime = new Date(serviceDate + "T00:00:00");
    depTime.setHours(h, m, 0, 0);
    if (today > depTime) passed.add(stop.station_id);
  }
  return passed;
}

// Strategy 2: Live GPS WebSocket feed
// Listens to real time departure events from the train's GPS system
// Server message shape: { trip_id, station_id, station_name, departed_at }
// Accurate regardless of delays. Requires live infrastructure
function computePassedStations_LiveFeed(_stops: TripStop[], _serviceDate: string, tripId: number, onUpdate: (stationId: number) => void,): () => void {
  const ws = new WebSocket(`ws://localhost:8080/api/trips/${tripId}/live`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data) as {
      trip_id: number;
      station_id: number;
      station_name: string;
      departed_at: string;
    };
    onUpdate(msg.station_id);
  };
  ws.onerror = (err) => console.warn("Live feed error:", err);
  // Returns a cleanup function to close the socket
  return () => ws.close();
}

export function RouteRail({ stations, stops, selectedIds, direction, serviceDate, tripId, onSelect }: Props) {

  const [passedIds, setPassedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (TRACKING_STRATEGY === TrackingStrategy.Schedule) {
      const update = () => setPassedIds(computePassedStations_Schedule(stops, serviceDate));
      update();
      const interval = setInterval(update, 30_000);
      return () => clearInterval(interval);
    }

    if (TRACKING_STRATEGY === TrackingStrategy.LiveFeed) {
      const cleanup = computePassedStations_LiveFeed(
        stops,
        serviceDate,
        tripId,
        (stationId) => setPassedIds((prev) => new Set([...prev, stationId])),
      );
      return cleanup;
    }
  }, [stops, serviceDate, tripId]);

  if (stations.length === 0) return null;

  const stopIds = new Set(stops.map((s) => s.station_id));
  const boardableIds = new Set(
    stops
      .filter((s) => s.can_board && !passedIds.has(s.station_id))
      .map((s) => s.station_id)
  );

  // For inbound trips, reverse station display order so origin is on left
  const displayStations = direction === "inbound" ? [...stations].reverse() : stations;

  // Determine origin/dest from selectedIds based on direction
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  let originId: number | null = null;
  let destId: number | null = null;
  if (selectedIds.length === 2) {
    const [a, b] = selectedIds;
    const seqA = stationMap.get(a)?.seq ?? 0;
    const seqB = stationMap.get(b)?.seq ?? 0;
    if (direction === "outbound") {
      originId = seqA <= seqB ? a : b;
      destId = seqA <= seqB ? b : a;
    } else {
      originId = seqA >= seqB ? a : b;
      destId = seqA >= seqB ? b : a;
    }
  } else if (selectedIds.length === 1) {
    originId = selectedIds[0];
  }

  // Compute x positions proportional to distance, with minimum gap
  const maxDistance = Math.max(...displayStations.map((s) => s.distance_km));
  const minDistance = Math.min(...displayStations.map((s) => s.distance_km));
  const range = maxDistance - minDistance;
  const MIN_GAP = 18;
  const TRACK_WIDTH = 920;
  const PAD = 40;

  const xs: number[] = [];
  let prevX = -Infinity;
  for (const s of displayStations) {
    const frac = range > 0 ? (s.distance_km - minDistance) / range : 0;
    let x = PAD + frac * TRACK_WIDTH;
    if (x < prevX + MIN_GAP) x = prevX + MIN_GAP;
    xs.push(x);
    prevX = x;
  }
  const totalWidth = xs[xs.length - 1] + PAD;

  const xById = new Map(displayStations.map((s, i) => [s.id, xs[i]]));
  const segX1 = originId !== null ? (xById.get(originId) ?? null) : null;
  const segX2 = destId !== null ? (xById.get(destId) ?? null) : null;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${totalWidth} ${HEIGHT}`}
        className="w-full select-none"
        style={{ height: `${HEIGHT}px` }}
        role="group"
        aria-label="Route diagram"
      >
        {/* Base track */}
        <line x1={PAD} y1={TRACK_Y} x2={totalWidth - PAD} y2={TRACK_Y}
          className="stroke-rail-green/20" strokeWidth={3} strokeLinecap="round" />

        {/* Selected segment highlight */}
        {segX1 !== null && segX2 !== null && (
          <line
            x1={Math.min(segX1, segX2)} y1={TRACK_Y}
            x2={Math.max(segX1, segX2)} y2={TRACK_Y}
            className="stroke-brass" strokeWidth={5} strokeLinecap="round"
          />
        )}

        {displayStations.map((s, i) => {
          const x = xs[i];
          const isStop = stopIds.has(s.id);
          const isPassed = passedIds.has(s.id);
          const canBoard = boardableIds.has(s.id);
          const isDisabled = !isStop;
          const isSelected = selectedIds.includes(s.id);
          const isOrigin = s.id === originId;
          const isDest = s.id === destId;
          const isInteractable = isStop && canBoard && !isPassed;

          return (
            <g
              key={s.id}
              onClick={() => { if (isInteractable) onSelect(s.id); }}
              className={isInteractable ? "cursor-pointer" : "cursor-not-allowed"}
              role={isDisabled ? "presentation" : "button"}
              tabIndex={isInteractable ? 0 : undefined}
              onKeyDown={(e) => {
                if (isInteractable && (e.key === "Enter" || e.key === " ")) onSelect(s.id);
              }}
              aria-pressed={isSelected}
              aria-disabled={!isInteractable}
            >
              <title>
                {isDisabled
                  ? "This train doesn't stop at this station"
                  : isPassed
                  ? "Train has already departed from this station"
                  : isSelected
                  ? s.name
                  : `Select ${s.name}`}
              </title>
              <circle cx={x} cy={TRACK_Y} r={14} fill="transparent" />
              <circle
                cx={x} cy={TRACK_Y}
                r={isSelected ? 8 : isStop ? 5 : 3}
                fill={
                  isSelected ? "#C08A2E"
                    : isDisabled ? "#C8BAA0"
                    : isPassed ? "#B0A090"
                    : ZONE_COLORS[s.zone] ?? "#6B8E6E"
                }
                stroke={isSelected ? "#1F3B2C" : isDisabled || isPassed ? "transparent" : "#1F3B2C"}
                strokeWidth={isSelected ? 2 : isStop ? 1.5 : 0}
                opacity={isDisabled ? 0.35 : isPassed ? 0.5 : 1}
              />
              {(isOrigin || isDest) && (
                <circle cx={x} cy={TRACK_Y} r={13} fill="transparent"
                  stroke="#C08A2E" strokeWidth={1.5}
                  strokeDasharray={isDest ? "3 2" : "none"} />
              )}
              {isStop && (
                <g transform={`translate(${x} ${TRACK_Y + 18}) rotate(-40)`}>
                  <text x={0} y={0} textAnchor="end"
                    fontSize={isPassed ? 9 : 10}
                    fontFamily="var(--font-plex-mono), monospace"
                    fill={isSelected ? "#1F3B2C" : isPassed ? "#A09080" : "#23201B99"}
                    fontWeight={isSelected ? "600" : "400"}
                  >
                    {isPassed ? `${s.name} ✓` : s.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Zone legend */}
      <div className="flex gap-3 mt-1 px-2 flex-wrap">
        {[1, 2, 3, 4, 5].map((z) => (
          <span key={z} className="flex items-center gap-1 font-mono text-[9px] text-ink/50 uppercase tracking-wide">
            <span style={{ background: ZONE_COLORS[z] }} className="inline-block w-2 h-2 rounded-full" />
            Zone {z}
          </span>
        ))}
        <span className="flex items-center gap-1 font-mono text-[9px] text-ink/50 uppercase tracking-wide">
          <span className="inline-block w-2 h-2 rounded-full bg-ink/20" />
          Passed
        </span>
      </div>
    </div>
  );
}
