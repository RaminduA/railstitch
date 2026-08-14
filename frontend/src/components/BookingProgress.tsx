"use client";

import { usePathname, useRouter } from "next/navigation";

const STEPS = [
  { label: "Select Train",    path: "/trains" },
  { label: "Choose Date",     path: null }, // /trains/[slug]
  { label: "Select Stations", path: null }, // /trips/[id] #route-rail
  { label: "Pick Seat",       path: null }, // /trips/[id] #seat-map
  { label: "Confirm",         path: null }, // /trips/[id] #confirm
  { label: "Ticket",          path: null }, // /bookings/[id]
];

function inferStep(pathname: string): number {
  if (/^\/trains$/.test(pathname)) return 0;
  if (/^\/trains\//.test(pathname)) return 1;
  if (/^\/trips\/\d+$/.test(pathname)) return 2;
  if (/^\/bookings\/\d+$/.test(pathname)) return 5;
  return -1;
}

type Props = {
  stepOverride?: number;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
};

export function BookingProgress({ stepOverride, onBack, onForward, canGoBack, canGoForward, }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const current = stepOverride ?? inferStep(pathname);
  if (current < 0) return null;
 
  function handleBack() {
    if (onBack) { onBack(); return; }
    if (current === 1) router.push("/trains");
    else if (current >= 2 && /^\/trips\//.test(pathname)) router.push("/trains");
    else if (current === 5) router.back();
    else router.back();
  }

  const backDisabled = canGoBack === false || current === 0;
  const forwardDisabled = canGoForward === false || !onForward;

  return (
    <div className="sticky top-[57px] z-40 bg-paper/95 backdrop-blur border-b border-rail-green/10 print:hidden">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
        <button
          onClick={handleBack}
          disabled={backDisabled}
          className="shrink-0 w-7 h-7 rounded-full border border-rail-green/20 flex items-center justify-center font-mono text-ink/40 hover:border-brass hover:text-brass transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          title="Previous step"
        >
          ‹
        </button>

        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar flex-1">
          {STEPS.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <div key={i} className="flex items-center gap-0.5 shrink-0">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wide ${
                  done ? "text-rail-green" : active ? "text-brass font-semibold" : "text-ink/25"
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] border shrink-0 ${
                    done ? "bg-rail-green border-rail-green text-paper"
                    : active ? "border-brass text-brass"
                    : "border-ink/15 text-ink/20"
                  }`}>
                    {done ? "✓" : i + 1}
                  </span>
                  <span className={active ? "" : "hidden sm:inline"}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <span className={`font-mono text-[10px] ${done ? "text-rail-green/30" : "text-ink/10"}`}>›</span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onForward}
          disabled={forwardDisabled}
          className="shrink-0 w-7 h-7 rounded-full border border-rail-green/20 flex items-center justify-center font-mono text-ink/40 hover:border-brass hover:text-brass transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          title="Next step"
        >
          ›
        </button>
      </div>
    </div>
  );
}
