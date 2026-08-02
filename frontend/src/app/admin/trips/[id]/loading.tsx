export default function Loading() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="h-3 w-20 rounded bg-ink/10 mb-6" />
        <div className="h-3 w-56 rounded bg-rail-green/15 mb-3" />
        <div className="h-10 w-72 rounded bg-rail-green/15 mb-8" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-white/40 border border-rail-green/10"
            />
          ))}
        </div>

        <div className="h-3 w-48 rounded bg-ink/10 mb-3" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-white/40 border border-rail-green/10"
            />
          ))}
        </div>
      </div>
    </main>
  );
}