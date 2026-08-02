import Link from "next/link";
import { api } from "@/lib/api";

export default async function AdminPage() {
  const trips = await api.getTrips(1);

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-2">
          Department view
        </p>
        <h1 className="font-display text-4xl text-rail-green mb-8">
          Occupancy &amp; revenue
        </h1>

        <div className="flex flex-col gap-3">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/admin/trips/${trip.id}`}
              className="flex items-center justify-between rounded-lg border border-rail-green/15 bg-white/40 px-5 py-4 hover:border-brass hover:bg-white/70 transition-colors"
            >
              <span className="font-display text-xl text-rail-green">
                {trip.name}
              </span>
              <span className="font-mono text-sm text-ink/60">
                {new Date(trip.service_date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}