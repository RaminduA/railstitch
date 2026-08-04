"use client";

import { useState } from "react";
import Link from "next/link";
import type { Trip, TripStop } from "@/lib/api";

type Props = {
  trainName: string;
  trips: Trip[];
  outboundStops: TripStop[];
  inboundStops: TripStop[];
};

export function TrainPageClient({
  trips,
  outboundStops,
  inboundStops,
}: Props) {
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");

  const currentStops = direction === "outbound" ? outboundStops : inboundStops;
  const currentTrips = trips
    .filter((t) => t.direction === direction)
    .sort((a, b) => a.service_date.localeCompare(b.service_date));

  return (
    <div className="flex flex-col gap-6">
      {/* Direction toggle */}
      <div className="flex rounded-lg border border-rail-green/15 bg-white/30 p-1 w-fit">
        <button
          onClick={() => setDirection("outbound")}
          className={`px-5 py-2 rounded-md font-mono text-xs uppercase tracking-wide transition-colors ${
            direction === "outbound"
              ? "bg-rail-green text-paper"
              : "text-ink/60 hover:text-ink"
          }`}
        >
          Colombo Fort → Badulla
        </button>
        <button
          onClick={() => setDirection("inbound")}
          className={`px-5 py-2 rounded-md font-mono text-xs uppercase tracking-wide transition-colors ${
            direction === "inbound"
              ? "bg-rail-green text-paper"
              : "text-ink/60 hover:text-ink"
          }`}
        >
          Badulla → Colombo Fort
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timetable */}
        <div className="rounded-xl border border-rail-green/15 bg-white/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-rail-green/10">
            <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50">
              Timetable
            </p>
            <p className="font-display text-lg text-rail-green mt-0.5">
              {direction === "outbound"
                ? "Colombo Fort → Badulla"
                : "Badulla → Colombo Fort"}
            </p>
          </div>
          <div className="overflow-y-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white/80 backdrop-blur border-b border-rail-green/10">
                <tr>
                  <th className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">
                    Station
                  </th>
                  <th className="text-right px-5 py-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">
                    Arr
                  </th>
                  <th className="text-right px-5 py-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">
                    Dep
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentStops.map((stop, i) => (
                  <tr
                    key={stop.id}
                    className={`border-b border-rail-green/5 ${
                      i === 0 || i === currentStops.length - 1
                        ? "bg-rail-green/5"
                        : ""
                    }`}
                  >
                    <td className="px-5 py-2 text-ink/80">
                      {stop.station_name}
                      {(i === 0 || i === currentStops.length - 1) && (
                        <span className="ml-2 font-mono text-[9px] uppercase text-ink/40">
                          {i === 0 ? "origin" : "terminus"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right font-mono text-xs text-ink/50">
                      {stop.arrival_time ?? "—"}
                    </td>
                    <td className="px-5 py-2 text-right font-mono text-xs text-ink/70">
                      {stop.departure_time ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Round selector */}
        <div className="flex flex-col gap-3">
          <div className="px-1">
            <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-1">
              Select a departure
            </p>
            <p className="font-display text-lg text-rail-green">
              Upcoming rounds
            </p>
          </div>
          {currentTrips.length === 0 ? (
            <div className="rounded-lg border border-rail-green/15 bg-white/40 px-5 py-8 text-center text-ink/50 font-mono text-sm">
              No upcoming departures in this direction
            </div>
          ) : (
            currentTrips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                className="flex items-center justify-between rounded-lg border border-rail-green/15 bg-white/40 px-5 py-4 hover:border-brass hover:bg-white/70 transition-colors group"
              >
                <div>
                  <p className="font-display text-lg text-rail-green">
                    {new Date(trip.service_date).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="font-mono text-xs text-ink/50 mt-0.5">
                    {direction === "outbound"
                      ? `Departs ${currentStops[0]?.departure_time ?? ""}`
                      : `Departs ${currentStops[0]?.departure_time ?? ""}`}
                  </p>
                </div>
                <span className="font-mono text-xs text-ink/40 group-hover:text-brass transition-colors">
                  Book →
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
