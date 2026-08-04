"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, type Booking } from "@/lib/api";
import type { AppUser } from "@/lib/auth";

export default function BookingHistoryPage() {
  const { data: session } = useSession();
  const user = session?.user as AppUser | undefined;
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.googleId) return;
    api.getUserBookings(user.googleId)
      .then(setBookings)
      .catch(() => setError("Failed to load your bookings."));
  }, [user?.googleId]);

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-2">
          Your account
        </p>
        <h1 className="font-display text-4xl text-rail-green mb-8">Booking History</h1>

        {error && <p className="text-signal-rust text-sm mb-4">{error}</p>}

        {bookings === null && !error ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-rail-green/10" />
            ))}
          </div>
        ) : bookings?.length === 0 ? (
          <div className="rounded-lg border border-rail-green/15 bg-white/40 px-5 py-8 text-center">
            <p className="text-ink/70 mb-4">You haven&apos;t booked any seats yet.</p>
            <Link
              href="/trains"
              className="inline-block rounded-md bg-rail-green text-paper px-5 py-2 font-medium hover:bg-rail-green-dim transition-colors"
            >
              Find a departure
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bookings?.map((b) => {
              const isCancelled = b.status === "cancelled";
              return (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className={`rounded-lg border px-5 py-4 flex items-center justify-between gap-4 hover:border-brass transition-colors ${
                    isCancelled
                      ? "border-ink/10 bg-white/20 opacity-60"
                      : "border-brass/40 bg-white/50"
                  }`}
                >
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink/40 mb-1">
                      {b.trip_name ?? `Trip #${b.trip_id}`}
                      {b.service_date && ` · ${new Date(b.service_date + "T12:00:00").toLocaleDateString()}`}
                    </p>
                    <p className="font-display text-lg text-rail-green">
                      {b.coach_number}, Seat {b.seat_number}
                    </p>
                    <p className="text-ink/70 text-sm">
                      {b.passenger_name} &middot; {b.origin_name} → {b.dest_name}
                    </p>
                    <p className="font-mono text-xs text-ink/50 mt-1">
                      Rs. {b.fare.toFixed(0)} &middot; booking #{b.id}
                      {isCancelled ? " · cancelled" : ""}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-ink/40 shrink-0">View →</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
