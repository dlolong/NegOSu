import { NextResponse } from "next/server";
import { queueDisplayResponseHeaders } from "@/lib/private-route-security";

export const dynamic = "force-dynamic";

// Slugs and branch IDs are public information, never queue credentials.
export async function GET() {
  return NextResponse.json({ error: "This customer queue is unavailable." }, { status: 404, headers: queueDisplayResponseHeaders });
}
