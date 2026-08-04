import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-rail-green/15 bg-paper/90 backdrop-blur">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo size={32} className="rounded-md" />
          <span className="font-display text-lg text-rail-green group-hover:text-brass transition-colors">
            Railstitch
          </span>
        </Link>
        <Link
          href="/my-bookings"
          className="font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-brass transition-colors"
        >
          My bookings
        </Link>
      </div>
    </header>
  );
}