"use client";

import { useMemo, useState } from "react";
import type { Station } from "@/lib/api";
import { RouteRail } from "@/components/RouteRail";
import { SeatPicker } from "./SeatPicker";

type Props = {
  tripId: number;
  stations: Station[];
};

export function TripBooking({ tripId, stations }: Props) {
  const [originId, setOriginId] = useState<number | null>(null);
  const [destId, setDestId] = useState<number | null>(null);

  const byId = useMemo(
    () => new Map(stations.map((s) => [s.id, s])),
    [stations],
  );

  function handleSelect(stationId: number) {
    if (originId === null) {
      setOriginId(stationId);
      return;
    }
    if (destId === null) {
      if (stationId === originId) {
        setOriginId(null);
        return;
      }
      const originSeq = byId.get(originId)!.seq;
      const tappedSeq = byId.get(stationId)!.seq;
      if (tappedSeq > originSeq) {
        setDestId(stationId);
      } else {
        setOriginId(stationId);
      }
      return;
    }

    setOriginId(stationId);
    setDestId(null);
  }

  const origin = originId !== null ? byId.get(originId) ?? null : null;
  const dest = destId !== null ? byId.get(destId) ?? null : null;
  const distanceKm =
    origin && dest ? Math.round((dest.distance_km - origin.distance_km) * 10) / 10 : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-rail-green/15 bg-white/40 px-4 py-6">
        <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-4">
          {!origin
            ? "Tap where you're boarding"
            : !dest
              ? "Tap where you're getting off"
              : "Your leg"}
        </p>
        <RouteRail
          stations={stations}
          originId={originId}
          destId={destId}
          onSelect={handleSelect}
        />
      </div>

      {origin && dest && distanceKm !== null && (
        <div className="flex items-center justify-between rounded-lg bg-rail-green text-paper px-5 py-4">
          <div>
            <span className="font-display text-lg">{origin.name}</span>
            <span className="mx-2 text-brass-bright">&rarr;</span>
            <span className="font-display text-lg">{dest.name}</span>
          </div>
          <span className="font-mono text-sm text-paper/80">
            {distanceKm} km
          </span>
        </div>
      )}

      {origin && dest && (
        <SeatPicker
          key={`${origin.id}-${dest.id}`}
          tripId={tripId}
          originId={origin.id}
          destId={dest.id}
        />
      )}
    </div>
  );
}
