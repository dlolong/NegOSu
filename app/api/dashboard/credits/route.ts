import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { creditUsageSchema } from "@/modules/platform/credits";
import { queueDisplayResponseHeaders as headers } from "@/lib/private-route-security";
export async function GET(request: Request) {
  try {
    const db = await createClient();
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user) return Response.json({ error: "Please sign in to view usage." }, { status: 401, headers });
    const { activeMembership: member } = await getDashboardContext();
    if (member.role !== "owner") return Response.json({ error: "Billing access required." }, { status: 403, headers });
    const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) return Response.json({ error: "Invalid usage page." }, { status: 400, headers });
    const { data, error } = await db.rpc("get_credit_usage", { p_org: member.organizationId, p_page: page });
    const parsed = creditUsageSchema.safeParse(data);
    if (error || !parsed.success) return Response.json({ error: "Usage could not be loaded. Try again shortly." }, { status: 503, headers });
    return Response.json({ ...parsed.data, organizationId: member.organizationId }, { headers });
  } catch { return Response.json({ error: "Usage could not be loaded. Try again shortly." }, { status: 503, headers }); }
}
