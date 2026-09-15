import { z } from "zod";
const optional = (max: number) => z.string().trim().max(max).nullable().optional().transform(value => value || null);
export const petSchema = z.object({
  id: z.uuid().nullable(), customer_id: z.uuid(), name: z.string().trim().min(1).max(120), species: z.enum(["dog", "cat", "other"]),
  breed: optional(120), date_of_birth: z.union([z.iso.date(), z.literal("")]).nullable().optional().transform(value => value || null),
  size_category: z.enum(["small", "medium", "large", "extra_large"]).nullable(), coat: optional(300),
  grooming_preferences: optional(1000), handling_cautions: optional(1000), is_active: z.boolean(),
});
export type Pet = z.output<typeof petSchema> & { id: string; organization_id: string };
export const groomingActions = (status: string, pickup: string) => {
  if (status === "completed") return pickup === "not_ready" ? ["ready"] : pickup === "ready" ? ["collect"] : [];
  return ({ requested: ["confirm", "arrive", "cancel", "no_show"], confirmed: ["arrive", "cancel", "no_show"], checked_in: ["start", "cancel"], in_service: ["finish"] } as Record<string, string[]>)[status] ?? [];
};
export const groomingActionLabels: Record<string, string> = { confirm: "Confirm", arrive: "Check in", start: "Start grooming", finish: "Finish grooming", ready: "Ready for pickup", collect: "Collected", cancel: "Cancel appointment", no_show: "Mark no-show" };
export function groomingStatus(status: string, pickup: string) {
  if (status === "completed") return pickup === "ready" ? "Ready for pickup" : pickup === "collected" ? "Collected" : "Grooming finished";
  return ({ requested: "Scheduled", confirmed: "Confirmed", checked_in: "Checked in", in_service: "Grooming in progress", cancelled: "Cancelled", no_show: "No-show" } as Record<string, string>)[status] ?? status;
}

export const groomingNoteSchema = z.object({
 id:z.uuid(), appointmentId:z.uuid(), note:z.string().trim().min(1,"Enter a grooming note.").max(3000),
 nextVisitOn:z.union([z.iso.date(),z.literal("")]).transform(value=>value||null),
});
