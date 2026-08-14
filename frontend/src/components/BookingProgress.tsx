"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { label: "Select Train" },
  { label: "Choose Date" },
  { label: "Select Stations" },
  { label: "Pick Seat" },
  { label: "Confirm" },
  { label: "Ticket" },
];

function inferStep(pathname: string): number {
  if (/^\/trains$/.test(pathname)) return 0;
  if (/^\/trains\//.test(pathname)) return 1;
  if (/^\/trips\/\d+$/.test(pathname)) return 2;
  if (/^\/bookings\/\d+$/.test(pathname)) return 5;
  return -1;
}

export function BookingProgress() {
  const pathname = usePathname();
  const current = inferStep(pathname);
  if (current < 0) return null;

  return (
    <div className="sticky top-[57px] z-40 bg-paper/95 backdrop-blur border-b border-rail-green/10 print:hidden">
      <div className="max-w-5xl mx-auto px-4 py-2">
        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {STEPS.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <div key={i} className="flex items-center gap-0.5 shrink-0">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wide ${
                  done ? "text-rail-green" : active ? "text-brass font-semibold" : "text-ink/25"
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] border shrink-0 ${
                    done
                      ? "bg-rail-green border-rail-green text-paper"
                      : active
                      ? "border-brass text-brass"
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
      </div>
    </div>
  );
}
