import Link from "next/link";
import { api } from "@/lib/api";

export default async function TrainsPage() {
  const trips = await api.getTrips(1);
  const trainNames = [...new Set(trips.map((t) => t.name))];

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="max-w-2xl w-full">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-3">
          Ceylon Government Railway &middot; Upcountry Line
        </p>
        <h1 className="font-display text-5xl md:text-6xl leading-[1.05] text-rail-green mb-4">
          Select a service
        </h1>
        <p className="text-ink/80 text-lg mb-10 max-w-lg">
          Book a reserved seat for exactly the leg you need.
          Someone else can take it for the rest of the way.
        </p>
        <h2 className="font-mono text-xs tracking-[0.15em] uppercase text-ink/50 mb-3">
          Express services
        </h2>
        <ul className="flex flex-col gap-3">
          {trainNames.map((name) => {
            const slug = name.toLowerCase().replace(/\s+/g, "-");
            const trainTrips = trips.filter((t) => t.name === name);
            const hasOutbound = trainTrips.some((t) => t.direction === "outbound");
            const hasInbound = trainTrips.some((t) => t.direction === "inbound");
            return (
              <li key={name}>
                <Link
                  href={`/trains/${slug}`}
                  className="flex items-center justify-between rounded-lg border border-rail-green/15 bg-white/40 px-5 py-5 hover:border-brass hover:bg-white/70 transition-colors group"
                >
                  <div>
                    <span className="font-display text-2xl text-rail-green">{name}</span>
                    <div className="flex gap-3 mt-1.5">
                      {hasOutbound && (
                        <span className="font-mono text-xs text-ink/50">Colombo Fort → Badulla</span>
                      )}
                      {hasOutbound && hasInbound && (
                        <span className="font-mono text-xs text-ink/30">·</span>
                      )}
                      {hasInbound && (
                        <span className="font-mono text-xs text-ink/50">Badulla → Colombo Fort</span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-ink/40 group-hover:text-brass transition-colors">
                    View schedule →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
