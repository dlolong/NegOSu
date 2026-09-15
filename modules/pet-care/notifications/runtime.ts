import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
export async function enqueuePetCareReminders() {
 const { data, error } = await createAdminClient().rpc("enqueue_due_pet_care_reminders", { p_limit: 100 });
 // A deployment without the Pet Care schema has no Pet records to enqueue.
 if (error?.code === "PGRST202") return 0;
 if (error) throw new Error("Unable to enqueue Pet Care reminders.");
 return Number(data ?? 0);
}
export async function petNotificationIsCurrent(outboxId: string) {
 const { data, error } = await createAdminClient().rpc("pet_care_notification_is_current", { p_outbox_id: outboxId });
 return !error && data === true;
}
