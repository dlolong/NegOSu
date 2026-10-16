import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDashboardContext } from "@/lib/auth/context";
import { queueDisplayResponseHeaders } from "@/lib/private-route-security";
import { loadAdminAttention } from "@/modules/platform/admin-attention";
import { reportActionError } from "@/lib/errors/action-error";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = await createClient();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Please sign in to view notifications." }, { status: 401, headers: queueDisplayResponseHeaders });
    const { activeMembership } = await getDashboardContext();
    const snapshot = await loadAdminAttention(db, activeMembership);
    if (activeMembership.role === "owner") {
      const notices = await db.rpc("get_credit_notices", { p_org: activeMembership.organizationId });
      if (notices.error) snapshot.unavailable.push("Usage notices");
      else { snapshot.creditNotices = notices.data ?? []; snapshot.total += snapshot.creditNotices!.filter(notice => !notice.readAt).length; }
    }
    return NextResponse.json(snapshot, { headers: queueDisplayResponseHeaders });
  } catch (error) {
    reportActionError("dashboard.notifications", error, "Notifications unavailable.");
    return NextResponse.json({ error: "Notifications could not be loaded. Please try again." }, { status: 503, headers: queueDisplayResponseHeaders });
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const db = await createClient();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { activeMembership } = await getDashboardContext();
    if (activeMembership.role !== "owner") return NextResponse.json({ error: "Billing access required." }, { status: 403 });
    const body = await request.json();
    const parsed = z.object({ id: z.uuid() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid notice." }, { status: 400 });
    const result = await db.rpc("read_credit_notice", { p_org: activeMembership.organizationId, p_notice: parsed.data.id });
    if (result.error) return NextResponse.json({ error: "Notice could not be updated." }, { status: 403 });
    return NextResponse.json({ success: true }, { headers: queueDisplayResponseHeaders });
  } catch { return NextResponse.json({ error: "Notice could not be updated." }, { status: 503 }); }
}
