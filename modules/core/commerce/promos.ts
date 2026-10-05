import { businessLogoUrlSchema } from "@/modules/platform/business-branding";
import { z } from "zod";
import { quantityThousandths } from "./quantity";

export const componentSchema = z.object({
  kind: z.enum(["service", "accommodation", "product", "supply"]),
  referenceId: z.uuid().nullable(),
  quantity: z.string().refine(value => { try { quantityThousandths(value); return true; } catch { return false; } }, "Use a positive quantity with up to three decimals."),
  unit: z.string().trim().min(1).max(30),
}).superRefine((value, context) => {
  if (value.kind === "accommodation" ? value.referenceId !== null : value.referenceId === null) context.addIssue({ code: "custom", message: "Select a valid component.", path: ["referenceId"] });
  if (["service", "accommodation"].includes(value.kind) && (value.quantity !== "1" || value.unit !== "service")) context.addIssue({ code: "custom", message: "Billable service components must use quantity 1 and the service unit." });
});
export const promoSchema = z.object({
  imageUrl: businessLogoUrlSchema.default(""), isPublic: z.boolean().default(false),
  name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000),
  priceCentavos: z.number().int().min(0).max(10_000_000_000),
  status: z.enum(["draft", "active", "archived"]),
  validFrom: z.iso.date().nullable(), validThrough: z.iso.date().nullable(),
  components: z.array(componentSchema).min(1,"Add at least one component.").max(30),
}).superRefine((value, context) => {
  if (value.validFrom && value.validThrough && value.validFrom > value.validThrough) context.addIssue({ code: "custom", message: "End date must be on or after start date." });
  if (value.components.some(c => c.kind === "accommodation") && value.components.some(c => c.kind === "service")) context.addIssue({ code: "custom", message: "Accommodation cannot be combined with appointment services." });
  if (value.isPublic && value.components.filter(c => c.kind === "service").length > 10) context.addIssue({ code: "custom", message: "Public booking supports up to 10 services per promo." });
  const keys = value.components.map(c => `${c.kind === "product" || c.kind === "supply" ? "inventory" : c.kind}:${c.referenceId?.toLowerCase()}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "Combine duplicate component quantities." });
});
export type PromoDefinition = z.infer<typeof promoSchema>;
export type PromoComponent = z.infer<typeof componentSchema>;
