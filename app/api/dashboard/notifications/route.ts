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
    return NextResponse.json(await loadAdminAttention(db, activeMembership), { headers: queueDisplayResponseHeaders });
  } catch (error) {
    reportActionError("dashboard.notifications", error, "Notifications unavailable.");
    return NextResponse.json({ error: "Notifications could not be loaded. Please try again." }, { status: 503, headers: queueDisplayResponseHeaders });
  }
}
