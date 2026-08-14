"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();

  // Redirect signed-in users to the trains page
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/trains");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse font-display text-2xl text-rail-green">Loading…</div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={48} className="rounded-xl" />
        </div>

        <p className="font-mono text-xs tracking-[0.3em] uppercase text-rail-green/60 mb-4">
          Ceylon Government Railway &middot; Upcountry Line
        </p>

        <h1 className="font-display text-6xl md:text-8xl leading-[1.0] text-rail-green mb-6 max-w-3xl">
          Colombo Fort<br />
          <span className="italic text-brass">to</span>{" "}
          Badulla
        </h1>

        <p className="text-ink/70 text-xl max-w-xl mb-4 leading-relaxed">
          Reserve a seat for exactly the leg you need.
          When you alight, the seat becomes available again
          for the next passenger.
        </p>
        <p className="font-mono text-sm text-ink/40 mb-12">
          303 km &middot; 49 stations &middot; ~10 hours &middot; 3 classes
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/trains" })}
          className="flex items-center gap-3 rounded-xl bg-rail-green text-paper px-8 py-4 font-display text-xl hover:bg-rail-green-dim transition-colors shadow-lg"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <p className="font-mono text-xs text-ink/40 mt-4">
          New to Railstitch? Signing in creates your account automatically.
        </p>
        <Link href="/trains" className="font-mono text-xs text-ink/50 hover:text-brass transition-colors mt-2 inline-block">
          Browse trains without signing in →
        </Link>
      </section>

      {/* Info strip */}
      <section className="border-t border-rail-green/10 bg-rail-green/5 px-6 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="text-center">
            <p className="font-display text-3xl text-rail-green mb-1">2</p>
            <p className="font-mono text-xs text-ink/50 uppercase tracking-wide">Express services daily</p>
            <p className="font-mono text-xs text-ink/40 mt-1">Podi Menike &middot; Udarata Menike</p>
          </div>
          <div className="text-center">
            <p className="font-display text-3xl text-rail-green mb-1">5</p>
            <p className="font-mono text-xs text-ink/50 uppercase tracking-wide">Pricing zones</p>
            <p className="font-mono text-xs text-ink/40 mt-1">Pay only for your leg</p>
          </div>
          <div className="text-center">
            <p className="font-display text-3xl text-rail-green mb-1">3</p>
            <p className="font-mono text-xs text-ink/50 uppercase tracking-wide">Seat classes</p>
            <p className="font-mono text-xs text-ink/40 mt-1">1st · 2nd · 3rd reserved</p>
          </div>
        </div>
      </section>
    </main>
  );
}
