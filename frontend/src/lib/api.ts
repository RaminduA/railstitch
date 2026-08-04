const isServer = typeof window === "undefined";
const API_URL = isServer
  ? (process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080")
  : (process.env.NEXT_PUBLIC_API_URL ?? "");

export type Station = {
  id: number;
  route_id: number;
  name: string;
  seq: number;
  distance_km: number;
  zone: number;
};

export type Trip = {
  id: number;
  route_id: number;
  name: string;
  service_date: string;
  direction: "outbound" | "inbound";
  overnight_outbound: boolean;
  overnight_inbound: boolean;
};

export type TripStop = {
  id: number;
  trip_id: number;
  station_id: number;
  station_name: string;
  seq: number;
  seq_in_trip: number;
  zone: number;
  distance_km: number;
  arrival_time: string | null;
  departure_time: string | null;
  can_board: boolean;
};

export type SeatWithStatus = {
  seat_id: number;
  coach_number: string;
  coach_class: string;
  seat_number: number;
  available: boolean;
  blocked_origin?: string;
  blocked_dest?: string;
};

export type CoachWithSeats = {
  coach_id: number;
  coach_number: string;
  class: "first" | "second" | "third";
  display_order: number;
  fare_adult: number;
  seats: SeatWithStatus[];
};

export type AvailabilityResponse = {
  trip_id: number;
  origin_station_id: number;
  dest_station_id: number;
  coaches: CoachWithSeats[];
};

export type Booking = {
  id: number;
  trip_id: number;
  trip_name?: string;
  service_date?: string;
  direction?: "outbound" | "inbound";
  seat_id: number;
  coach_number?: string;
  coach_class?: string;
  seat_number?: number;
  origin_station_id: number;
  dest_station_id: number;
  origin_name?: string;
  dest_name?: string;
  passenger_name: string;
  passenger_type: "adult" | "child" | "student" | "senior";
  fare: number;
  status: "confirmed" | "cancelled";
  created_at: string;
  verification_token?: string;
  user_id?: string;
};

export type WaitlistEntry = {
  id: number;
  trip_id: number;
  origin_station_id: number;
  dest_station_id: number;
  class: string;
  passenger_name: string;
  passenger_type: string;
  status: "waiting" | "promoted" | "cancelled";
  created_at: string;
};

export type LegOccupancy = {
  from_station: string;
  to_station: string;
  occupied_seats: number;
  capacity: number;
  occupancy_pct: number;
};

export type TripSummary = {
  trip_id: number;
  total_revenue: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  waiting_count: number;
  reserved_seat_capacity: number;
  leg_occupancy: LegOccupancy[];
};

export type DayOff = {
  id: number;
  day: string;
  reason: string;
  created_at: string;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* keep generic message */ }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getStations: (routeId: number) =>
    request<Station[]>(`/api/routes/${routeId}/stations`),

  getTrips: (routeId = 1) =>
    request<Trip[]>(`/api/trips?route_id=${routeId}`),

  getTripStops: (tripId: number) =>
    request<TripStop[]>(`/api/trips/${tripId}/stops`),

  getAvailability: (tripId: number, originId: number, destId: number) =>
    request<AvailabilityResponse>(
      `/api/trips/${tripId}/availability?origin=${originId}&dest=${destId}`,
    ),

  createBooking: (
    tripId: number,
    payload: {
      origin_station_id: number;
      dest_station_id: number;
      passenger_name: string;
      passenger_type: string;
      seat_id?: number;
      class?: string;
      user_id?: string;
    },
  ) =>
    request<Booking>(`/api/trips/${tripId}/bookings`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getBooking: (bookingId: number) =>
    request<Booking>(`/api/bookings/${bookingId}`),

  listBookings: (tripId: number) =>
    request<Booking[]>(`/api/trips/${tripId}/bookings`),

  cancelBooking: (bookingId: number) =>
    request<{ cancelled: boolean; promoted_waitlist: boolean }>(
      `/api/bookings/${bookingId}`,
      { method: "DELETE" },
    ),

  createWaitlistEntry: (
    tripId: number,
    payload: {
      origin_station_id: number;
      dest_station_id: number;
      passenger_name: string;
      passenger_type?: string;
      class?: string;
    },
  ) =>
    request<WaitlistEntry>(`/api/trips/${tripId}/waitlist`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listWaitlist: (tripId: number) =>
    request<WaitlistEntry[]>(`/api/trips/${tripId}/waitlist`),

  getTripSummary: (tripId: number) =>
    request<TripSummary>(`/api/admin/trips/${tripId}/summary`),

  getUserBookings: (userId: string) =>
    request<Booking[]>(`/api/users/${userId}/bookings`),

  verifyBooking: (bookingId: number, token: string) =>
    request<{ booking: Booking; valid: boolean }>(
      `/api/bookings/${bookingId}/verify?token=${token}`,
    ),

  findOrCreateTrip: (payload: {
    train_name: string;
    service_date: string;
    direction: "outbound" | "inbound";
  }) =>
    request<Trip>(`/api/trips/find-or-create`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getDaysOff: () => request<DayOff[]>(`/api/admin/days-off`),

  getDaysOffInRange: (from: string, to: string) =>
    request<string[]>(`/api/admin/days-off/range?from=${from}&to=${to}`),

  addDayOff: (day: string, reason: string) =>
    request<DayOff>(`/api/admin/days-off`, {
      method: "POST",
      body: JSON.stringify({ day, reason }),
    }),

  removeDayOff: (day: string) =>
    request<{ deleted: boolean }>(`/api/admin/days-off/${day}`, {
      method: "DELETE",
    }),
};
