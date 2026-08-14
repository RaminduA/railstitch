import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { api } from "@/lib/api";
import { TicketView } from "./TicketView";
import { UnauthorizedPage } from "@/components/UnauthorizedPage";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId)) notFound();

  const [_session, booking] = await Promise.all([
    getSession(),
    api.getBooking(bookingId),
  ]);

  if (!booking) notFound();

  const user = _session?.user as { googleId?: string; isAdmin?: boolean } | undefined;
  const isOwner = !!user?.googleId && user.googleId === booking.user_id;
  const canCancel = isOwner;

  // Only the booking owner can view their ticket
  if (booking.user_id && !isOwner) {
    return <UnauthorizedPage title="Not your ticket" message="You can only view tickets from your own bookings." />;
  }

  // Fetch trip info for the ticket
  const trips = await api.getTrips(1);
  const trip = trips.find((t) => t.id === booking.trip_id);

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <TicketView
          booking={booking}
          trip={trip}
          canCancel={canCancel}
        />
      </div>
    </main>
  );
}
