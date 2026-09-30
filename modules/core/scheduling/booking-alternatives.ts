import { z } from "zod";

export const proposeAlternativeSchema = z.object({
  id: z.uuid(), version: z.coerce.number().int().min(0),
  startsAt: z.iso.datetime({ local: true, precision: -1 }),
  staffId: z.uuid().nullable(), resourceId: z.uuid().nullable(),
  message: z.string().trim().max(1000),
});
export const respondAlternativeSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.coerce.number().int().positive(), action: z.enum(["accept", "cancel"]),
});
export function alternativeError(error: { code?: string } | null) {
  if (["PGRST202", "42P01", "PGRST205"].includes(error?.code ?? "")) return "Booking alternatives need database setup. Ask the administrator to apply migration 0108.";
  if (error?.code === "40001") return "This offer changed. Refresh to see the latest suggestion.";
  if (error?.code === "42501") return "This booking is unavailable or you do not have access.";
  return "This alternative is no longer available. The business may need to suggest another time or staff member.";
}
