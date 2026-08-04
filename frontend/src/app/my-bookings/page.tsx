"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Booking, type Trip } from "@/lib/api";
import { getMyBookings, markMyBookingCancelled } from "@/lib/myBookings";

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [trips, setTrips] = useState<Record<number, Trip>>({});
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    // Reading localStorage once on mount, no subscription available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookings(getMyBookings());
    api
      .getTrips(1)
      .then((list) => {
        setTrips(Object.fromEntries(list.map((t) => [t.id, t])));
      })
      .catch(() => {
        
      });
  }, []);

  async function handleCancel(id: number) {
    setCancellingId(id);
    try {
      await api.cancelBooking(id);
      markMyBookingCancelled(id);
      setBookings((prev) =>
        prev
          ? prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b))
          : prev,
      );
    } catch {
      
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-2">
          This browser only
        </p>
        <h1 className="font-display text-4xl text-rail-green mb-3">
          My bookings
        </h1>
        <p className="text-ink/70 mb-8 max-w-lg text-sm">
          Railstitch doesn&apos;t have accounts yet, so this list is tied to
          this browser, not a login. Booking on another device won&apos;t
          show up here.
        </p>

        {bookings === null ? (
          <BookingsSkeleton />
        ) : bookings.length === 0 ? (
          <div className="rounded-lg border border-rail-green/15 bg-white/40 px-5 py-8 text-center">
            <p className="text-ink/70 mb-4">
              You haven&apos;t booked a seat yet.
            </p>
            <Link
              href="/"
              className="inline-block rounded-md bg-rail-green text-paper px-5 py-2 font-medium hover:bg-rail-green-dim transition-colors"
            >
              Find a departure
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[...bookings]
              .sort((a, b) => b.id - a.id)
              .map((b) => {
                const trip = trips[b.trip_id];
                const isCancelled = b.status === "cancelled";
                return (
                  <div
                    key={b.id}
                    className={
                      "rounded-lg border px-5 py-4 flex items-center justify-between gap-4 " +
                      (isCancelled
                        ? "border-ink/10 bg-white/20 opacity-60"
                        : "border-brass/60 bg-white/50")
                    }
                  >
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink/40 mb-1">
                        {trip
                          ? `${trip.name} \u00b7 ${new Date(
                              trip.service_date,
                            ).toLocaleDateString()}`
                          : `Trip #${b.trip_id}`}
                      </p>
                      <p className="font-display text-lg text-rail-green">
                        Coach {b.coach_number}, Seat {b.seat_number}
                      </p>
                      <p className="text-ink/70 text-sm">
                        {b.passenger_name} &middot; {b.origin_name} &rarr;{" "}
                        {b.dest_name}
                      </p>
                      <p className="font-mono text-xs text-ink/50 mt-1">
                        Rs. {b.fare.toFixed(2)} &middot; booking #{b.id}
                        {isCancelled ? " \u00b7 cancelled" : ""}
                      </p>
                    </div>
                    {!isCancelled && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        disabled={cancellingId === b.id}
                        className="shrink-0 rounded-md border border-signal-rust/50 text-signal-rust px-3 py-1.5 text-sm hover:bg-signal-rust hover:text-paper transition-colors disabled:opacity-40"
                      >
                        {cancellingId === b.id ? "Cancelling\u2026" : "Cancel"}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </main>
  );
}

function BookingsSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 rounded-lg bg-rail-green/10" />
      ))}
    </div>
  );
}
