import { api } from "@/lib/api";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const bookingId = Number(id);

  if (!Number.isFinite(bookingId) || !token) {
    return <VerifyLayout valid={false} message="Invalid verification link." />;
  }

  let valid = false;
  let booking = null;
  try {
    const result = await api.verifyBooking(bookingId, token);
    valid = result.valid;
    booking = result.booking;
  } catch {
    valid = false;
  }

  if (!valid || !booking) {
    return <VerifyLayout valid={false} message="This ticket could not be verified." />;
  }

  const isCancelled = booking.status === "cancelled";

  return (
    <VerifyLayout valid={!isCancelled} message={isCancelled ? "CANCELLED" : "VALID TICKET"}>
      <div className="mt-6 rounded-xl border border-rail-green/15 bg-white/40 px-5 py-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Passenger" value={`${booking.passenger_name} (${booking.passenger_type})`} />
          <Field label="Booking" value={`#${String(booking.id).padStart(6, "0")}`} />
          <Field label="From" value={booking.origin_name ?? ""} />
          <Field label="To" value={booking.dest_name ?? ""} />
          <Field label="Coach" value={booking.coach_number ?? ""} />
          <Field label="Seat" value={String(booking.seat_number)} />
          <Field label="Class" value={booking.coach_class ?? ""} />
          <Field label="Fare" value={`Rs. ${booking.fare.toFixed(0)}`} />
        </div>
      </div>
    </VerifyLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink/40">{label}</p>
      <p className="font-mono text-sm text-ink/80 font-medium">{value}</p>
    </div>
  );
}

function VerifyLayout({
  valid,
  message,
  children,
}: {
  valid: boolean;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
          valid ? "bg-rail-green/10" : "bg-signal-rust/10"
        }`}>
          <span className="text-4xl">{valid ? "✓" : "✗"}</span>
        </div>
        <p className={`font-display text-3xl mb-2 ${valid ? "text-rail-green" : "text-signal-rust"}`}>
          {message}
        </p>
        <p className="font-mono text-xs text-ink/40 mb-4">Railstitch ticket verification</p>
        {children}
      </div>
    </main>
  );
}
