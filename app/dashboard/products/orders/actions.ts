"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
export async function resolvePublicProductOrder(form: FormData) {
  const { activeMembership: m } = await getDashboardContext();
  const value = z.object({ id: z.uuid(), action: z.enum(["confirm", "decline"]) }).safeParse(Object.fromEntries(form));
  if (!value.success || !["owner", "manager", "cashier"].includes(m.role)) redirect("/dashboard/products/orders?error=Order%20unavailable.");
  const db = await createClient();
  const { data: order } = await db.from("public_product_orders").select("id").eq("id", value.data.id).eq("organization_id", m.organizationId).eq("branch_id", m.branchId).maybeSingle();
  if (!order) redirect("/dashboard/products/orders?error=Order%20unavailable%20in%20this%20branch.");
  const { data, error } = await db.rpc("resolve_public_product_order", { p_id: order.id, p_action: value.data.action });
  if (error) redirect(`/dashboard/products/orders?error=${encodeURIComponent("Unable to update this order. Check stock, product availability and price, or whether another staff member already resolved it. Contact the customer if the order needs to change.")}`);
  revalidatePath("/dashboard/products/orders");
  revalidatePath("/dashboard/customers", "layout");
  revalidatePath("/dashboard/inventory");
  if (value.data.action === "confirm" && z.uuid().safeParse(data).success) redirect(`/dashboard/checkout/${data}`);
  redirect("/dashboard/products/orders?message=Order%20declined.");
}
