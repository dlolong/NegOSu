import { zonedDateTimeToUtc } from "@/lib/operations";

/** Resolve a staff-entered wall-clock time using the authoritative branch timezone. */
export function resolveArrivalTime(local: string, timezone: string, now = new Date()): string {
  const arrival = zonedDateTimeToUtc(local, timezone);
  if (!arrival) throw new Error("Enter a valid check-in date and time for this branch.");
  if (arrival.getTime() > now.getTime()) throw new Error("Check-in date and time cannot be in the future.");
  return arrival.toISOString();
}

export function resolvePastBookingTimes(arrivalLocal: string, departureLocal: string | null, timezone: string, now = new Date()) {
  const arrival = resolveArrivalTime(arrivalLocal, timezone, now);
  if (new Date(arrival).getTime() >= now.getTime()) throw new Error("Manual bookings must have a past check-in time.");
  const departure = departureLocal === null ? null : zonedDateTimeToUtc(departureLocal, timezone);
  if (departureLocal !== null && (!departure || departure.getTime() > now.getTime() || departure.getTime() <= new Date(arrival).getTime()))
    throw new Error("Checkout must be after check-in and cannot be in the future.");
  return { arrival, departure: departure?.toISOString() ?? null };
}
