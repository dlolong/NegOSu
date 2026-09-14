import { NextResponse } from "next/server";
import { loadReservationQueue } from "@/lib/reservation-queue";
import { createPublicClient } from "@/lib/supabase/public";
import { QueueDisplayError } from "@/lib/queue-display-service";
import { queueDisplayResponseHeaders } from "@/lib/private-route-security";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    return NextResponse.json(await loadReservationQueue(token, createPublicClient()), { headers: queueDisplayResponseHeaders });
  } catch (error) {
    const status = error instanceof QueueDisplayError ? error.status : 503;
    return NextResponse.json({ error: status === 503 ? "Queue updates are temporarily unavailable." : "This reservation queue is unavailable." }, { status, headers: queueDisplayResponseHeaders });
  }
}
