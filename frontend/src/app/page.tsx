import Link from "next/link";
import { api } from "@/lib/api";

export default async function HomePage() {
  const trips = await api.getTrips(1);

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="max-w-2xl w-full">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-3">
          Ceylon Government Railway · Upcountry Line
        </p>
        <h1 className="font-display text-5xl md:text-6xl leading-[1.05] text-rail-green mb-4">
          Colombo Fort <span className="italic text-brass">to</span> Badulla
        </h1>
        <p className="text-ink/80 text-lg mb-10 max-w-lg">
          Book a reserved seat for exactly the leg you need.
          Someone else can take it for the rest of the way.
        </p>

        <h2 className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-3">
          Upcoming departures
        </h2>
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                className="flex items-center justify-between rounded-lg border border-rail-green/15 bg-white/40 px-5 py-4 hover:border-brass hover:bg-white/70 transition-colors"
              >
                <div>
                  <span className="font-display text-xl text-rail-green">
                    {trip.name}
                  </span>
                  <span className={`ml-3 font-mono text-xs px-2 py-0.5 rounded-full ${
                    trip.direction === "outbound"
                      ? "bg-rail-green/10 text-rail-green"
                      : "bg-brass/10 text-brass"
                  }`}>
                    {trip.direction === "outbound" ? "→ Badulla" : "→ Colombo"}
                  </span>
                </div>
                <span className="font-mono text-sm text-ink/60">
                  {new Date(trip.service_date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
