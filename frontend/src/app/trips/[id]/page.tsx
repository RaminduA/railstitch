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

  const [trips, stations] = await Promise.all([
    api.getTrips(1),
    api.getStations(1),
  ]);
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) notFound();

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-4xl mx-auto">
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
        <TripBooking tripId={trip.id} stations={stations} />
      </div>
    </main>
  );
}