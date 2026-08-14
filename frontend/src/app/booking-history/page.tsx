"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { api, type Booking } from "@/lib/api";
import type { AppUser } from "@/lib/auth";

type CancelState = "cancellable" | "in-use" | "expired" | "cancelled";

function getBookingState(b: Booking): CancelState {
  if (b.status === "cancelled") return "cancelled";
  const serviceDate = b.service_date;
  if (!serviceDate) return "expired";
  const now = new Date();

  function toDateTime(hhmm: string | null | undefined): Date | null {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date(serviceDate! + "T00:00:00");
    d.setHours(h, m, 0, 0);
    return d;
  }

  const originDep = toDateTime(b.origin_departure_time);
  const destArr = toDateTime(b.dest_arrival_time);

  if (!originDep) return "expired";
  if (now < originDep) return "cancellable";
  if (!destArr || now < destArr) return "in-use";
  return "expired";
}

function cancelTooltip(state: CancelState): string {
  switch (state) {
    case "in-use": return "Ticket is in use: train has passed the boarding station";
    case "expired": return "Ticket has expired: journey is complete";
    case "cancelled": return "This booking has already been cancelled";
    default: return "";
  }
}

export default function BookingHistoryPage() {
  const { data: session } = useSession();
  const user = session?.user as AppUser | undefined;
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.googleId) return;
    let cancelled = false;
    api.getUserBookings(user.googleId)
      .then((data) => { if (!cancelled) setBookings(data); })
      .catch(() => { if (!cancelled) setError("Failed to load your bookings."); });
    return () => { cancelled = true; };
  }, [user?.googleId]);

  async function handleCancel(bookingId: number) {
    if (!confirm("Cancel this booking? This cannot be undone.")) return;
    setCancellingId(bookingId);
    try {
      await api.cancelBooking(bookingId);
      setBookings((prev) =>
        prev ? prev.map((b) => b.id === bookingId ? { ...b, status: "cancelled" as const } : b) : prev
      );
    } catch {
      alert("Failed to cancel. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-2">Your account</p>
        <h1 className="font-display text-4xl text-rail-green mb-8">Booking History</h1>

        {error && <p className="text-signal-rust text-sm mb-4">{error}</p>}

        {bookings === null && !error ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-lg bg-rail-green/10" />)}
          </div>
        ) : bookings?.length === 0 ? (
          <div className="rounded-lg border border-rail-green/15 bg-white/40 px-5 py-8 text-center">
            <p className="text-ink/70 mb-4">You haven&apos;t booked any seats yet.</p>
            <Link href="/trains" className="inline-block rounded-md bg-rail-green text-paper px-5 py-2 font-medium hover:bg-rail-green-dim transition-colors">
              Find a departure
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bookings?.map((b) => {
              const state = getBookingState(b);
              const isCancelled = state === "cancelled";
              const canCancel = state === "cancellable";
              const tooltip = cancelTooltip(state);

              return (
                <div
                  key={b.id}
                  className={`rounded-lg border px-5 py-4 flex items-center justify-between gap-4 ${
                    isCancelled ? "border-ink/10 bg-white/20 opacity-60" : "border-brass/40 bg-white/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink/40 mb-1">
                      {b.trip_name ?? `Trip #${b.trip_id}`}
                      {b.service_date && ` · ${new Date(b.service_date + "T12:00:00").toLocaleDateString()}`}
                    </p>
                    <p className="font-display text-lg text-rail-green">
                      {b.coach_number}, Seat {b.seat_number}
                    </p>
                    <p className="text-ink/70 text-sm truncate">
                      {b.origin_name} → {b.dest_name}
                    </p>
                    <p className="font-mono text-xs text-ink/50 mt-1">
                      Rs. {b.fare.toFixed(0)} &middot; booking #{b.id}
                      {isCancelled ? " · cancelled" : ""}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {/* View ticket: always enabled */}
                    <Link
                      href={`/bookings/${b.id}`}
                      className="rounded-md border border-rail-green/40 text-rail-green px-3 py-1.5 text-sm hover:border-brass hover:text-brass transition-colors"
                    >
                      View ticket
                    </Link>
                    {/* Cancel: state-aware */}
                    <div title={tooltip || undefined}>
                      {canCancel ? (
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={cancellingId === b.id}
                          className="rounded-md border border-signal-rust/50 text-signal-rust px-3 py-1.5 text-sm hover:bg-signal-rust hover:text-paper transition-colors disabled:opacity-40"
                        >
                          {cancellingId === b.id ? "Cancelling…" : "Cancel"}
                        </button>
                      ) : (
                        <button disabled className="rounded-md border border-ink/15 text-ink/30 px-3 py-1.5 text-sm cursor-not-allowed">
                          {isCancelled ? "Cancelled" : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
