import Link from "next/link";

const ADMIN_CARDS = [
  {
    href: "/admin/occupancy",
    title: "Occupancy & Revenue",
    description: "View booking counts, revenue, and per-leg occupancy for any trip",
  },
  {
    href: "/admin/days-off",
    title: "Days Off",
    description: "Block specific dates when trains are not running",
  },
];

export default function AdminPage() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-rail-green/70 mb-2">
          Department view
        </p>
        <h1 className="font-display text-4xl text-rail-green mb-8">
          Admin panel
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADMIN_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="flex flex-col rounded-xl border border-rail-green/15 bg-white/40 px-6 py-5 hover:border-brass hover:bg-white/70 transition-colors group"
            >
              <span className="font-display text-xl text-rail-green group-hover:text-rail-green mb-1">
                {card.title}
              </span>
              <span className="font-mono text-xs text-ink/50">
                {card.description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
