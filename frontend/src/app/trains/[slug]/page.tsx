import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { TrainPageClient } from "./TrainPageClient";

const KNOWN_TRAINS: Record<string, string> = {
  "podi-menike": "Podi Menike",
  "udarata-menike": "Udarata Menike",
};

export default async function TrainPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trainName = KNOWN_TRAINS[slug];
  if (!trainName) notFound();

  const trips = await api.getTrips(1);
  const outboundTrip = trips.find((t) => t.name === trainName && t.direction === "outbound");
  const inboundTrip  = trips.find((t) => t.name === trainName && t.direction === "inbound");

  const [outboundStops, inboundStops] = await Promise.all([
    outboundTrip ? api.getTripStops(outboundTrip.id) : Promise.resolve([]),
    inboundTrip  ? api.getTripStops(inboundTrip.id)  : Promise.resolve([]),
  ]);

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-ink/50 hover:text-brass transition-colors mb-6"
        >
          ← All services
        </Link>
        <h1 className="font-display text-4xl text-rail-green mb-8">{trainName}</h1>
        <TrainPageClient
          trainName={trainName}
          outboundStops={outboundStops}
          inboundStops={inboundStops}
        />
      </div>
    </main>
  );
}
