import type { Booking } from "./api";

const STORAGE_KEY = "railstitch:my-bookings";

export function getMyBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    
    return parsed.filter(
      (b: unknown) =>
        b &&
        typeof b === "object" &&
        "coach_class" in b &&
        "passenger_type" in b,
    );
  } catch {
    return [];
  }
}

export function addMyBooking(booking: Booking) {
  if (typeof window === "undefined") return;
  const current = getMyBookings();
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...current, booking]),
  );
}

export function markMyBookingCancelled(bookingId: number) {
  if (typeof window === "undefined") return;
  const current = getMyBookings();
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      current.map((b) =>
        b.id === bookingId ? { ...b, status: "cancelled" as const } : b,
      ),
    ),
  );
}
