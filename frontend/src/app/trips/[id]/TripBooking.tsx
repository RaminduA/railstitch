"use client";

import { useState } from "react";
import type { Station, Trip, TripStop } from "@/lib/api";
import { RouteRail } from "@/components/RouteRail";
import { SeatPicker } from "./SeatPicker";

type Props = {
  trip: Trip;
  stations: Station[];
  stops: TripStop[];
};

export function TripBooking({ trip, stations, stops }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const stopMap = new Map(stops.map((s) => [s.station_id, s]));
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  function handleSelect(stationId: number) {
    setSelectedIds((prev) => {
      if (prev.length === 2) return [stationId]; // start over
      if (prev.includes(stationId)) return prev.filter((id) => id !== stationId); // deselect
      return [...prev, stationId];
    });
  }

  let originId: number | null = null;
  let destId: number | null = null;
  if (selectedIds.length === 2) {
    const [a, b] = selectedIds;
    const seqA = stationMap.get(a)?.seq ?? 0;
    const seqB = stationMap.get(b)?.seq ?? 0;
    if (trip.direction === "outbound") {
      originId = seqA <= seqB ? a : b;
      destId = seqA <= seqB ? b : a;
    } else {
      originId = seqA >= seqB ? a : b;
      destId = seqA >= seqB ? b : a;
    }
  }

  const origin = originId !== null ? stationMap.get(originId) ?? null : null;
  const dest = destId !== null ? stationMap.get(destId) ?? null : null;

  const originStop = origin ? stopMap.get(origin.id) ?? null : null;
  const destStop = dest ? stopMap.get(dest.id) ?? null : null;

  const distanceKm =
    origin && dest
      ? Math.abs(dest.distance_km - origin.distance_km).toFixed(1)
      : null;

  const crossings =
    origin && dest ? Math.abs(dest.zone - origin.zone) : null;

  const directionLabel =
    trip.direction === "outbound"
      ? "Colombo Fort → Badulla"
      : "Badulla → Colombo Fort";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-rail-green/15 bg-white/40 px-4 py-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50">
            {selectedIds.length === 0
              ? "Tap your boarding station"
              : selectedIds.length === 1
              ? "Tap your alighting station"
              : "Your leg"}
          </p>
          <span className="font-mono text-[10px] text-ink/40 uppercase tracking-wide">
            {directionLabel}
          </span>
        </div>
        <RouteRail
          stations={stations}
          stops={stops}
          selectedIds={selectedIds}
          direction={trip.direction}
          serviceDate={trip.service_date}
          tripId={trip.id}
          onSelect={handleSelect}
        />
      </div>

      {origin && dest && originStop && destStop && (
        <>
          <div className="flex items-center justify-between rounded-lg bg-rail-green text-paper px-5 py-4">
            <div>
              <span className="font-display text-lg">{origin.name}</span>
              <span className="mx-2 text-brass-bright">→</span>
              <span className="font-display text-lg">{dest.name}</span>
              {crossings !== null && (
                <span className="ml-3 font-mono text-xs text-paper/60">
                  Zone {origin.zone} → Zone {dest.zone}
                  {crossings === 0 ? " (intra-zone)" : ` (${crossings} crossing${crossings > 1 ? "s" : ""})`}
                </span>
              )}
            </div>
            <span className="font-mono text-sm text-paper/80">
              {distanceKm} km
            </span>
          </div>

          <SeatPicker
            key={`${origin.id}-${dest.id}`}
            tripId={trip.id}
            originId={origin.id}
            destId={dest.id}
          />
        </>
      )}
    </div>
  );
}
