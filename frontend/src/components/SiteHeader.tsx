"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { Logo } from "./Logo";
import type { AppUser } from "@/lib/auth";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const user = session?.user as AppUser | undefined;
  const isAdmin = user?.isAdmin ?? false;
  const loading = status === "loading";

  const homeHref = session ? (isAdmin ? "/admin" : "/trains") : "/";

  return (
    <header className="sticky top-0 z-50 border-b border-rail-green/15 bg-paper/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <Link href={homeHref} className="flex items-center gap-3 group">
          <Logo size={32} className="rounded-md" />
          <span className="font-display text-lg text-rail-green group-hover:text-brass transition-colors">
            Railstitch
          </span>
        </Link>

        {session && (
          <nav className="hidden sm:flex items-center gap-6">
            {isAdmin ? (
              <>
                <Link href="/admin/occupancy" className="font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-brass transition-colors">
                  Occupancy
                </Link>
                <Link href="/admin/days-off" className="font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-brass transition-colors">
                  Days Off
                </Link>
              </>
            ) : (
              <>
                <Link href="/trains" className="font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-brass transition-colors">
                  Book a Ticket
                </Link>
                <Link href="/booking-history" className="font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-brass transition-colors">
                  Booking History
                </Link>
              </>
            )}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-rail-green/10 animate-pulse" />
          ) : session ? (
            <>
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "User"}
                  width={32}
                  height={32}
                  className="rounded-full border border-rail-green/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-rail-green flex items-center justify-center text-paper text-xs font-bold">
                  {user?.name?.charAt(0) ?? "U"}
                </div>
              )}
              <span className="hidden sm:block font-mono text-xs text-ink/70">
                {user?.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="font-mono text-xs uppercase tracking-wide text-ink/50 hover:text-signal-rust transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("google", { callbackUrl: "/trains" })}
              className="font-mono text-xs uppercase tracking-wide text-brass hover:text-rail-green transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
