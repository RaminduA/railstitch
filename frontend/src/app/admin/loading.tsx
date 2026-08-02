export default function Loading() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="h-3 w-32 rounded bg-rail-green/15 mb-4" />
        <div className="h-10 w-64 rounded bg-rail-green/15 mb-8" />
        <div className="flex flex-col gap-3">
          <div className="h-16 rounded-lg bg-white/40 border border-rail-green/10" />
          <div className="h-16 rounded-lg bg-white/40 border border-rail-green/10" />
        </div>
      </div>
    </main>
  );
}