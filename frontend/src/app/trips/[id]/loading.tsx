export default function Loading() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-3 w-32 rounded bg-ink/10 mb-6" />
        <div className="h-3 w-64 rounded bg-rail-green/15 mb-3" />
        <div className="h-10 w-80 rounded bg-rail-green/15 mb-8" />

        <div className="rounded-xl border border-rail-green/15 bg-white/40 px-4 py-6">
          <div className="h-3 w-48 rounded bg-ink/10 mb-4" />
          <div className="h-28 rounded bg-rail-green/10" />
        </div>
      </div>
    </main>
  );
}