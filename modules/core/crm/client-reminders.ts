import { z } from "zod";
import { zonedDateTimeToUtc } from "@/lib/operations";

export const reminderSchema = z.object({
  id: z.uuid(), customerId: z.uuid(), branchId: z.uuid(),
  reason: z.string().trim().min(1, "Enter a reminder reason.").max(500),
  dueAt: z.iso.datetime({ local: true, precision: -1 }),
});
export function reminderInstant(value: string, timezone: string) {
  return zonedDateTimeToUtc(value, timezone)?.toISOString() ?? null;
}
export function historyPage(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 50001) : 1;
}
export function appointmentBackLink(from: string | undefined, pet = false) {
  return from === "clients"
    ? { href: "/dashboard/customers", label: "Back to Clients" }
    : { href: pet ? "/dashboard/pet-care/appointments" : "/dashboard/appointments", label: "Back to Appointments" };
}

/** Pending reminders remain actionable from 24 hours before their due instant. */
export function reminderAttentionCutoff(now: Date) {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
}
