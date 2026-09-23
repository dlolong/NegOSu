import { z } from "zod";

export const adminMutationSchema = z.object({
  action: z.enum(["delete_user", "delete_business", "update_subscription", "update_plan"]),
  target: z.string().min(1).max(120), requestId: z.uuid(),
  expected: z.string().max(80).default(""), reason: z.string().trim().min(5).max(500),
  confirmation: z.string().max(160).default(""),
  name: z.string().default(""), monthly: z.string().default(""), yearly: z.string().default(""),
  planId: z.string().default(""), status: z.string().default(""), expiresAt: z.string().default(""),
});

export function priceCentavos(value: string): number | null {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return amount <= 1_000_000_000 ? amount : null;
}

export function parseAdminMutation(data: Record<string, unknown>) {
  const parsed = adminMutationSchema.safeParse(data);
  if (!parsed.success) return { error: "Check the form and provide a reason of 5–500 characters." } as const;
  const input = parsed.data;
  let values: Record<string, unknown> = {};
  if (input.action === "update_plan") {
    const monthly = priceCentavos(input.monthly), yearly = input.yearly === "" ? null : priceCentavos(input.yearly);
    if (!/^[a-z0-9_-]+$/.test(input.target) || !/^\d+$/.test(input.expected) || input.name.trim().length < 2 || input.name.trim().length > 80 || monthly === null || (input.yearly !== "" && yearly === null)) return { error: "Enter a plan name and valid PHP prices with at most two decimal places." } as const;
    values = { name: input.name.trim(), monthly, yearly };
  } else {
    if (!z.uuid().safeParse(input.target).success) return { error: "Invalid record." } as const;
    if (input.action.startsWith("delete_")) {
      if (input.confirmation !== `DELETE ${input.target}`) return { error: "Type the exact deletion confirmation shown below." } as const;
    } else {
      if (!/^[a-z0-9_-]{1,80}$/.test(input.planId) || !["free", "active", "paused", "cancelled"].includes(input.status) || !z.iso.datetime({ offset: true }).safeParse(input.expected).success) return { error: "Choose a valid plan and subscription status. Reload if the record has changed." } as const;
      if (input.status === "active" && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.expiresAt) || !z.iso.datetime().safeParse(`${input.expiresAt}:00Z`).success || Date.parse(`${input.expiresAt}:00Z`) <= Date.now())) return { error: "Active access requires a future expiry date and time in UTC." } as const;
      if ((input.status === "free" && input.planId !== "free") || (input.status === "active" && input.planId === "free")) return { error: "Free status requires the Free plan; active status requires a paid or custom plan." } as const;
      values = { planId: input.planId, status: input.status, expiresAt: input.status === "active" ? `${input.expiresAt}:00Z` : null };
    }
  }
  return { input, values } as const;
}

export function adminMutationError(error: { code?: string; message?: string }) {
  if (error.code === "23503") return "This record is still referenced by business, billing, or storage history. Remove or transfer those dependencies before deletion.";
  if (error.code === "40001") return "This record changed after you opened it. Close this form and reopen it before saving.";
  if (error.code === "P0002") return "This record no longer exists. Refresh the directory.";
  const allowed = new Set(["Invalid plan price", "Stripe-linked prices must be changed through Stripe", "Manage Stripe subscriptions through Stripe", "Resolve open or review payments first", "Transfer business ownership before deleting this user", "Business has retained billing or stay records", "Deletion confirmation does not match", "You cannot delete your own account", "Invalid subscription details", "Admin request conflict"]);
  return error.message && allowed.has(error.message) ? `${error.message}.` : "The change could not be saved. Refresh and try again.";
}
