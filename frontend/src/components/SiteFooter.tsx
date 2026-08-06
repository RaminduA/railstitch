"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import type { AppUser } from "@/lib/auth";

export function SiteFooter() {
  const { data: session } = useSession();
  const user = session?.user as AppUser | undefined;
  const isAdmin = user?.isAdmin ?? false;
  const isSignedIn = !!session;

  return (
    <footer className="border-t border-rail-green/15 mt-auto bg-paper/60">
      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <p className="font-display text-base text-rail-green mb-1">Railstitch</p>
          <p className="font-mono text-xs text-ink/50 leading-relaxed">
            Colombo Fort &ndash; Badulla<br />
            Upcountry Line
          </p>
          <p className="font-mono text-xs text-ink/30 mt-3">
            &copy; {new Date().getFullYear()} Ceylon Government Railway
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40 mb-2">Services</p>
          <p className="font-mono text-xs text-ink/60 leading-relaxed">
            Podi Menike &mdash; departs 05:55<br />
            Udarata Menike &mdash; departs 08:30<br />
            Journey: ~10 hours &middot; 303 km
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40 mb-2">Links</p>
          <div className="flex flex-col gap-1">
            {isSignedIn && !isAdmin && (
              <>
                <Link href="/trains" className="font-mono text-xs text-ink/60 hover:text-brass transition-colors">Book a Ticket</Link>
                <Link href="/booking-history" className="font-mono text-xs text-ink/60 hover:text-brass transition-colors">Booking History</Link>
              </>
            )}
            {isSignedIn && isAdmin && (
              <>
                <Link href="/admin/occupancy" className="font-mono text-xs text-ink/60 hover:text-brass transition-colors">Occupancy & Revenue</Link>
                <Link href="/admin/days-off" className="font-mono text-xs text-ink/60 hover:text-brass transition-colors">Days Off</Link>
              </>
            )}
            <a href="https://www.railway.gov.lk" target="_blank" rel="noopener noreferrer"
              className="font-mono text-xs text-ink/60 hover:text-brass transition-colors">
              Sri Lanka Railways ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
