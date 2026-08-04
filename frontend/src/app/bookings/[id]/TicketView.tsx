"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import type { Booking, Trip } from "@/lib/api";
import { api } from "@/lib/api";

type Props = {
  booking: Booking;
  trip: Trip | undefined;
  canCancel: boolean;
};

const CLASS_NAMES: Record<string, string> = {
  first:  "1st Class — Air Conditioned",
  second: "2nd Class — Reserved",
  third:  "3rd Class — Reserved",
};

const PASSENGER_LABELS: Record<string, string> = {
  adult:   "Adult",
  child:   "Child",
  student: "Student",
  senior:  "Senior",
};

export function TicketView({ booking, trip, canCancel }: Props) {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const isCancelled = booking.status === "cancelled";

  const verifyUrl = booking.verification_token
    ? `${typeof window !== "undefined" ? window.location.origin : "https://railstitch.com"}/verify/${booking.id}?token=${booking.verification_token}`
    : null;

  useEffect(() => {
    if (!verifyUrl) return;
    QRCode.toDataURL(verifyUrl, {
      width: 160,
      margin: 1,
      color: { dark: "#1F3B2C", light: "#EDE3C8" },
    }).then(setQrDataUrl).catch(() => {});
  }, [verifyUrl]);

  async function handleCancel() {
    if (!confirm("Cancel this booking? This cannot be undone.")) return;
    setCancelling(true);
    try {
      await api.cancelBooking(booking.id);
      router.refresh();
    } catch {
      alert("Failed to cancel. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  const serviceDate = trip?.service_date
    ? new Date(trip.service_date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      })
    : null;

  const dirLabel = trip?.direction === "outbound"
    ? "Colombo Fort → Badulla"
    : "Badulla → Colombo Fort";

  return (
    <div className="flex flex-col gap-6">
      {/* Ticket */}
      <div
        id="ticket-printable"
        className={`relative rounded-xl overflow-hidden border-2 ${
          isCancelled ? "border-ink/20 opacity-60" : "border-rail-green/30"
        }`}
        style={{ background: "#EDE3C8", fontFamily: "var(--font-plex-mono), monospace" }}
      >
        {/* Perforation line left edge */}
        <div
          className="absolute left-12 top-0 bottom-0 border-l-2 border-dashed border-ink/20 z-10"
          style={{ borderLeftStyle: "dashed", borderSpacing: "4px" }}
        />

        {/* Ticket number — rotated on left */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-rail-green">
          <span
            className="text-paper font-mono text-xs tracking-widest"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            #{String(booking.id).padStart(6, "0")}
          </span>
        </div>

        {/* Main ticket content */}
        <div className="ml-12 flex flex-col">
          {/* Top section */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-ink/50 mb-0.5">
                  S.L.R. &middot; Railstitch &middot; Reserved Seat
                </p>
                <p className="font-mono text-[9px] text-ink/40">
                  Valid for date and train shown only
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] text-ink/50">{serviceDate}</p>
                <p className="font-mono text-[9px] text-ink/40">{dirLabel}</p>
              </div>
            </div>
          </div>

          {/* SLR signature stripes */}
          <div className="mx-5">
            <div className="h-2 rounded-sm mb-0.5" style={{ background: "#C0003A" }} />
            <div className="h-2 rounded-sm" style={{ background: "#C0003A" }} />
          </div>

          {/* Journey info */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-end justify-between gap-4">
              <div className="flex-1">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/40 mb-1">From</p>
                <p className="font-display text-2xl text-rail-green leading-tight">{booking.origin_name}</p>
              </div>
              <div className="text-ink/30 font-mono text-lg px-2">→</div>
              <div className="flex-1 text-right">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/40 mb-1">To</p>
                <p className="font-display text-2xl text-rail-green leading-tight">{booking.dest_name}</p>
              </div>
            </div>
          </div>

          {/* Second stripes */}
          <div className="mx-5">
            <div className="h-px" style={{ background: "#C0003A", opacity: 0.4 }} />
          </div>

          {/* Details grid */}
          <div className="px-5 py-3 grid grid-cols-3 gap-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-ink/40">Train</p>
              <p className="font-mono text-xs text-ink/80 font-medium">{trip?.name ?? "—"}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-ink/40">Coach</p>
              <p className="font-mono text-xs text-ink/80 font-medium">{booking.coach_number}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-ink/40">Seat</p>
              <p className="font-mono text-xs text-ink/80 font-medium">{booking.seat_number}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-ink/40">Class</p>
              <p className="font-mono text-xs text-ink/80 font-medium">{CLASS_NAMES[booking.coach_class ?? "third"]}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-ink/40">Passenger</p>
              <p className="font-mono text-xs text-ink/80 font-medium">
                {booking.passenger_name} &middot; {PASSENGER_LABELS[booking.passenger_type]}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wide text-ink/40">Fare</p>
              <p className="font-mono text-xs text-ink/80 font-medium">Rs. {booking.fare.toFixed(0)}</p>
            </div>
          </div>

          {/* Bottom: barcode strip + QR */}
          <div className="mx-5 mb-4 flex items-center justify-between gap-4 border-t border-ink/10 pt-3">
            {/* Simulated barcode */}
            <div className="flex gap-px items-end h-8 flex-1">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0"
                  style={{
                    width: i % 3 === 0 ? 3 : i % 5 === 0 ? 2 : 1,
                    height: `${50 + (i * 7 + booking.id * 3) % 50}%`,
                    background: "#1F3B2C",
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
            {/* QR code */}
            {qrDataUrl && (
              <div className="flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Verification QR" width={64} height={64} />
              </div>
            )}
          </div>

          {/* Cancelled overlay text */}
          {isCancelled && (
            <div className="absolute inset-0 ml-12 flex items-center justify-center pointer-events-none">
              <span
                className="font-display text-4xl text-signal-rust/40 rotate-[-15deg] tracking-widest border-4 border-signal-rust/30 px-4 py-1"
              >
                CANCELLED
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-rail-green/30 text-rail-green px-5 py-2 font-mono text-sm hover:border-brass hover:text-brass transition-colors"
        >
          Print ticket
        </button>
        {canCancel && !isCancelled && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="rounded-lg border border-signal-rust/40 text-signal-rust px-5 py-2 font-mono text-sm hover:bg-signal-rust hover:text-paper transition-colors disabled:opacity-40"
          >
            {cancelling ? "Cancelling…" : "Cancel booking"}
          </button>
        )}
        {isCancelled && (
          <span className="font-mono text-sm text-ink/40">This booking has been cancelled.</span>
        )}
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-printable, #ticket-printable * { visibility: visible; }
          #ticket-printable { position: fixed; top: 20px; left: 20px; width: 90vw; }
        }
      `}</style>
    </div>
  );
}
