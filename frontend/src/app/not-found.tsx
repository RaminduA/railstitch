import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-mono text-xs tracking-[0.2em] uppercase text-brass mb-3">
        End of the line
      </p>
      <h1 className="font-display text-4xl text-rail-green mb-4">
        This station doesn&apos;t exist
      </h1>
      <p className="text-ink/70 mb-8 max-w-sm">
        The page you&apos;re looking for isn&apos;t on the timetable.
      </p>
      <Link
        href="/"
        className="rounded-md bg-rail-green text-paper px-5 py-2 font-medium hover:bg-rail-green-dim transition-colors"
      >
        Back to departures
      </Link>
    </main>
  );
}