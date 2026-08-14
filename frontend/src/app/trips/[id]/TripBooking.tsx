"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { UnauthorizedPage } from "@/components/UnauthorizedPage";
import type { Station, Trip, TripStop } from "@/lib/api";
import { RouteRail } from "@/components/RouteRail";
import { SeatPicker } from "./SeatPicker";

type Props = {
  trip: Trip;
  stations: Station[];
  stops: TripStop[];
};

type RestoredSeat = { seatId: number; coachClass: string };

function LoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-rail-green/20 border-t-rail-green animate-spin" />
    </div>
  );
}

export function TripBooking({ trip, stations, stops }: Props) {
  const { data: session, status } = useSession();
  const sessionUser = session?.user as { googleId?: string; isAdmin?: boolean } | undefined;
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [restoredState, setRestoredState] = useState<{ originId: number; destId: number } | null>(null);
  const [restoredSeats, setRestoredSeats] = useState<RestoredSeat[]>([]);
  const [restoredPtypes, setRestoredPtypes] = useState<Record<number, string>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Restore booking state after OAuth redirect
  useEffect(() => {
    if (!session) return;
    const raw = sessionStorage.getItem("railstitch:booking");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        tripId: number; originId: number; destId: number;
        selected?: RestoredSeat[]; ptypes?: Record<number, string>;
      };
      if (saved.tripId !== trip.id) return;
      sessionStorage.removeItem("railstitch:booking");
      queueMicrotask(() => {
        setSelectedIds([saved.originId, saved.destId]);
        setRestoredState({ originId: saved.originId, destId: saved.destId });
        if (saved.selected?.length) setRestoredSeats(saved.selected);
        if (saved.ptypes && Object.keys(saved.ptypes).length) setRestoredPtypes(saved.ptypes);
        setToastMsg("Welcome back — your seat selections are saved. Please confirm to book.");
      });
      setTimeout(() => setToastMsg(null), 4000);
    } catch { /* ignore */ }
  }, [session, trip.id]);

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

  // Auth checks after all hooks
  if (status === "loading") return <LoadingSpinner />;
  if (sessionUser?.isAdmin) return <UnauthorizedPage title="Admin area" message="Admins cannot access passenger booking pages. Use the admin dashboard instead." />;

  return (
    <div className="flex flex-col gap-6">
      {toastMsg && (
        <div className="rounded-lg bg-rail-green text-paper px-4 py-3 font-mono text-sm animate-fade-in">
          {toastMsg}
        </div>
      )}
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
            initialSeats={restoredSeats}
            initialPtypes={restoredPtypes}
          />
        </>
      )}
    </div>
  );
}
