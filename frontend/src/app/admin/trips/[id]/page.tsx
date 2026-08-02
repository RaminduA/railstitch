import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

export default async function AdminTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) notFound();

  const [trips, summary] = await Promise.all([
    api.getTrips(1),
    api.getTripSummary(tripId),
  ]);
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) notFound();

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-ink/50 hover:text-brass transition-colors mb-6"
        >
          &larr; All trips
        </Link>
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-2">
          {new Date(trip.service_date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <h1 className="font-display text-4xl text-rail-green mb-8">
          {trip.name}
        </h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <Stat label="Revenue" value={`Rs. ${summary.total_revenue.toFixed(2)}`} />
          <Stat label="Confirmed" value={String(summary.confirmed_bookings)} />
          <Stat label="Cancelled" value={String(summary.cancelled_bookings)} />
          <Stat label="Waitlisted" value={String(summary.waiting_count)} />
        </div>

        <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-3">
          Occupancy by leg &middot; {summary.reserved_seat_capacity} reserved
          seats total
        </p>
        <div className="flex flex-col gap-2">
          {summary.leg_occupancy.map((leg, i) => (
            <div
              key={i}
              className="rounded-lg border border-rail-green/15 bg-white/40 px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-rail-green font-medium">
                  {leg.from_station} &rarr; {leg.to_station}
                </span>
                <span className="font-mono text-xs text-ink/60">
                  {leg.occupied_seats}/{leg.capacity} &middot;{" "}
                  {leg.occupancy_pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-rail-green/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brass"
                  style={{ width: `${Math.min(leg.occupancy_pct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-rail-green/15 bg-white/40 px-4 py-3">
      <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink/40 mb-1">
        {label}
      </p>
      <p className="font-display text-xl text-rail-green">{value}</p>
    </div>
  );
}