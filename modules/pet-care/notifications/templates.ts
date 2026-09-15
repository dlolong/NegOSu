import type { NotificationTemplateRenderer } from "@/lib/notifications/outbox";
import { z } from "zod";
const payloadSchema = z.object({ businessName: z.string(), branchName: z.string(), ownerFirstName: z.string(), petName: z.string(), startsAt: z.string(), timezone: z.string(), kind: z.enum(["confirmation","reminder","ready"]), services: z.array(z.string()) });
export function renderPetCareNotification(appUrl: string): NotificationTemplateRenderer {
 return ({ templateKey, payload, deliverySecret }) => {
  const p = payloadSchema.parse(payload);
  if (!templateKey.startsWith(`pet-care-${p.kind}-`)) throw new Error("Pet Care template is unavailable.");
  if (p.kind !== "ready" && !deliverySecret) throw new Error("Appointment link unavailable.");
  const time = new Intl.DateTimeFormat("en-PH",{timeZone:p.timezone,dateStyle:"medium",timeStyle:"short"}).format(new Date(p.startsAt));
  const message = p.kind === "ready" ? `${p.petName} is ready for pickup at ${p.branchName}.` : `${p.kind === "reminder" ? "Reminder: " : "Please confirm: "}${p.petName}'s ${p.services.join(", ")} on ${time} at ${p.branchName}. Confirm or reschedule: ${appUrl}/appointment/${deliverySecret}`;
  return { subject: `${p.businessName}: ${p.kind === "ready" ? "Ready for pickup" : "Grooming appointment"}`, body: `${p.businessName}: Hi ${p.ownerFirstName}, ${message}` };
 };
}
