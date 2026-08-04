export default function Loading() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-3 w-24 rounded bg-ink/10 mb-6" />
        <div className="h-10 w-64 rounded bg-rail-green/15 mb-8" />
        <div className="h-10 w-80 rounded bg-rail-green/10 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 rounded-xl bg-white/40 border border-rail-green/10" />
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-white/40 border border-rail-green/10" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
