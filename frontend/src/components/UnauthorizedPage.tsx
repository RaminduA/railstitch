"use client";

type Props = {
  title?: string;
  message?: string;
};

export function UnauthorizedPage({
  title = "Access denied",
  message = "You don't have permission to view this page.",
}: Props) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-signal-rust/10 flex items-center justify-center mb-6">
        <span className="font-mono text-2xl text-signal-rust">✕</span>
      </div>
      <h1 className="font-display text-3xl text-rail-green mb-3">{title}</h1>
      <p className="font-mono text-sm text-ink/60 max-w-sm">{message}</p>
    </main>
  );
}
