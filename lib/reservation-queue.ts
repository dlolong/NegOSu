import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueueDisplaySnapshot } from "@/lib/queue-display";
import { QueueDisplayError } from "@/lib/queue-display-service";

/** Eligibility, organization, branch, and day are resolved from the private token in SQL. */
export async function loadReservationQueue(token: string, db: SupabaseClient): Promise<QueueDisplaySnapshot> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new QueueDisplayError(400);
  const { data, error } = await db.rpc("get_reservation_queue", { p_booking_token: token });
  if (error) throw new QueueDisplayError(503);
  if (!data) throw new QueueDisplayError(404);
  return data as QueueDisplaySnapshot;
}
