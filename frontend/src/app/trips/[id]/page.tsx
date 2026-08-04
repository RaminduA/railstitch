import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { TripBooking } from "./TripBooking";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) notFound();

  const [trips, stations, stops] = await Promise.all([
    api.getTrips(1),
    api.getStations(1),
    api.getTripStops(tripId),
  ]);

  const trip = trips.find((t) => t.id === tripId);
  if (!trip) notFound();

  const directionLabel =
    trip.direction === "outbound"
      ? "Colombo Fort → Badulla"
      : "Badulla → Colombo Fort";

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-ink/50 hover:text-brass transition-colors mb-6"
        >
          ← All departures
        </Link>
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-1">
          {new Date(trip.service_date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          <span className="ml-3 text-ink/40">{directionLabel}</span>
        </p>
        <h1 className="font-display text-4xl text-rail-green mb-8">
          {trip.name}
        </h1>
        <TripBooking trip={trip} stations={stations} stops={stops} />
      </div>
    </main>
  );
}
