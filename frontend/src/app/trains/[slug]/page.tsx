import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { TrainPageClient } from "./TrainPageClient";

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function TrainPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trainName = slugToName(slug);

  const trips = await api.getTrips(1);
  const trainTrips = trips.filter((t) => t.name === trainName);
  if (trainTrips.length === 0) notFound();

  // Fetch stops for one outbound and one inbound trip to get timetable data
  const outboundTrip = trainTrips.find((t) => t.direction === "outbound");
  const inboundTrip = trainTrips.find((t) => t.direction === "inbound");

  const [outboundStops, inboundStops] = await Promise.all([
    outboundTrip ? api.getTripStops(outboundTrip.id) : Promise.resolve([]),
    inboundTrip ? api.getTripStops(inboundTrip.id) : Promise.resolve([]),
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
        <h1 className="font-display text-4xl text-rail-green mb-8">
          {trainName}
        </h1>
        <TrainPageClient
          trainName={trainName}
          trips={trainTrips}
          outboundStops={outboundStops}
          inboundStops={inboundStops}
        />
      </div>
    </main>
  );
}
