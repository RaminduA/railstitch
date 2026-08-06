import Link from "next/link";
import { notFound } from "next/navigation";
import { api, type TripSummary } from "@/lib/api";

export default async function AdminTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) notFound();

  const trips = await api.getTrips(1);
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) notFound();

  let summary: TripSummary;
  try {
    summary = await api.getTripSummary(tripId);
  } catch {
    summary = {
      trip_id: tripId,
      total_revenue: 0,
      confirmed_bookings: 0,
      cancelled_bookings: 0,
      waiting_count: 0,
      reserved_seat_capacity: 0,
      leg_occupancy: [],
    };
  }

  const dirLabel = trip.direction === "outbound"
    ? "Colombo Fort → Badulla"
    : "Badulla → Colombo Fort";

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/admin/occupancy"
          className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-ink/50 hover:text-brass transition-colors mb-6"
        >
          ← Occupancy &amp; revenue
        </Link>
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-1">
          {new Date(trip.service_date + "T12:00:00").toLocaleDateString(undefined, {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
          })}
          <span className="ml-3 text-ink/40">{dirLabel}</span>
        </p>
        <h1 className="font-display text-4xl text-rail-green mb-8">{trip.name}</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <Stat label="Revenue" value={`Rs. ${summary.total_revenue.toFixed(0)}`} />
          <Stat label="Confirmed" value={String(summary.confirmed_bookings)} />
          <Stat label="Cancelled" value={String(summary.cancelled_bookings)} />
          <Stat label="Waitlisted" value={String(summary.waiting_count)} />
        </div>

        <p className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-3">
          Occupancy by leg · {summary.reserved_seat_capacity} reserved seats total
        </p>

        {summary.leg_occupancy.length === 0 ? (
          <div className="rounded-lg border border-rail-green/15 bg-white/40 px-5 py-8 text-center">
            <p className="text-ink/50 font-mono text-sm">No bookings yet for this trip.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {summary.leg_occupancy.map((leg, i) => (
              <div key={i} className="rounded-lg border border-rail-green/15 bg-white/40 px-4 py-3">
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-rail-green font-medium">
                    {leg.from_station} → {leg.to_station}
                  </span>
                  <span className="font-mono text-xs text-ink/60">
                    {leg.occupied_seats}/{leg.capacity} · {leg.occupancy_pct.toFixed(0)}%
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
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-rail-green/15 bg-white/40 px-4 py-3">
      <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink/40 mb-1">{label}</p>
      <p className="font-display text-xl text-rail-green">{value}</p>
    </div>
  );
}
