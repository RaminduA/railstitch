"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "./Logo";
import type { AppUser } from "@/lib/auth";

export function SiteHeader() {
  const { data: session, status } = useSession();
  const user = session?.user as AppUser | undefined;
  const isAdmin = user?.isAdmin;
  const loading = status === "loading";

  return (
    <header className="sticky top-0 z-50 border-b border-rail-green/15 bg-paper/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo + wordmark */}
        <Link href={session ? "/trains" : "/"} className="flex items-center gap-3 group">
          <Logo size={32} className="rounded-md" />
          <span className="font-display text-lg text-rail-green group-hover:text-brass transition-colors">
            Railstitch
          </span>
        </Link>

        {/* Nav links */}
        {session && (
          <nav className="hidden sm:flex items-center gap-6">
            {!isAdmin && (
              <>
                <Link href="/trains" className="font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-brass transition-colors">
                  Trains
                </Link>
                <Link href="/booking-history" className="font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-brass transition-colors">
                  Booking History
                </Link>
              </>
            )}
            {isAdmin && (
              <Link href="/admin" className="font-mono text-xs uppercase tracking-wide text-ink/60 hover:text-brass transition-colors">
                Admin Panel
              </Link>
            )}
          </nav>
        )}

        {/* User area */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-rail-green/10 animate-pulse" />
          ) : session ? (
            <>
              {user?.image && (
                <Image
                  src={user.image}
                  alt={user.name ?? "User"}
                  width={32}
                  height={32}
                  className="rounded-full border border-rail-green/20"
                />
              )}
              <span className="hidden sm:block font-mono text-xs text-ink/70">
                {user?.name?.split(" ")[0]}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="font-mono text-xs uppercase tracking-wide text-ink/50 hover:text-signal-rust transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/"
              className="font-mono text-xs uppercase tracking-wide text-brass hover:text-rail-green transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
