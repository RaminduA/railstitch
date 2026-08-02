export default function Loading() {
  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="max-w-2xl w-full animate-pulse">
        <div className="h-3 w-56 rounded bg-rail-green/15 mb-4" />
        <div className="h-12 w-full max-w-md rounded bg-rail-green/15 mb-3" />
        <div className="h-12 w-2/3 max-w-xs rounded bg-rail-green/15 mb-6" />
        <div className="h-4 w-full max-w-lg rounded bg-ink/10 mb-2" />
        <div className="h-4 w-2/3 max-w-md rounded bg-ink/10 mb-10" />

        <div className="h-3 w-40 rounded bg-ink/10 mb-3" />
        <div className="flex flex-col gap-3">
          <div className="h-16 rounded-lg bg-white/40 border border-rail-green/10" />
          <div className="h-16 rounded-lg bg-white/40 border border-rail-green/10" />
        </div>
      </div>
    </main>
  );
}