const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type Station = {
  id: number;
  route_id: number;
  name: string;
  seq: number;
  distance_km: number;
};

export type Trip = {
  id: number;
  route_id: number;
  name: string;
  service_date: string;
};

export type SeatAvailability = {
  seat_id: number;
  coach_number: string;
  seat_number: number;
  fare: number;
};

export type AvailabilityResponse = {
  class: "reserved" | "unreserved";
  distance_km?: number;
  fare?: number;
  fare_estimate?: number;
  note?: string;
  seats: SeatAvailability[];
};

export type Booking = {
  id: number;
  trip_id: number;
  seat_id: number;
  coach_number?: string;
  seat_number?: number;
  origin_station_id: number;
  dest_station_id: number;
  origin_name?: string;
  dest_name?: string;
  passenger_name: string;
  fare: number;
  status: "confirmed" | "cancelled";
  created_at: string;
};

export type WaitlistEntry = {
  id: number;
  trip_id: number;
  origin_station_id: number;
  dest_station_id: number;
  class: string;
  passenger_name: string;
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
    } catch {
      // response wasn't JSON; keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getStations: (routeId: number) =>
    request<Station[]>(`/api/routes/${routeId}/stations`),

  getTrips: (routeId = 1) => request<Trip[]>(`/api/trips?route_id=${routeId}`),

  getAvailability: (
    tripId: number,
    originId: number,
    destId: number,
    seatClass: "reserved" | "unreserved" = "reserved",
  ) =>
    request<AvailabilityResponse>(
      `/api/trips/${tripId}/availability?origin=${originId}&dest=${destId}&class=${seatClass}`,
    ),

  createBooking: (
    tripId: number,
    payload: {
      origin_station_id: number;
      dest_station_id: number;
      passenger_name: string;
      seat_id?: number;
      class?: string;
    },
  ) =>
    request<Booking>(`/api/trips/${tripId}/bookings`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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
};