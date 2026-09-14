import { cache } from "react";
import { businessMetadata } from "@/modules/platform/business-branding";
import { CustomerQueueDisplay } from "@/components/customer-queue-display";
import { createClient } from "@/lib/supabase/server";
import { loadQueueDisplay } from "@/lib/queue-display-service";

export const dynamic = "force-dynamic";
const loadDisplay = cache(async (branchId: string) => loadQueueDisplay(branchId, await createClient()).catch(() => null));
export async function generateMetadata({ params }: { params: Promise<{ branchId: string }> }) {
  const display = await loadDisplay((await params).branchId);
  return { ...businessMetadata(display?.organizationName ?? "Customer queue", display?.logoUrl, "Customer queue"), robots: { index: false, follow: false, nocache: true } };
}

export default async function QueueDisplayPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;
  const initialData = await loadDisplay(branchId);
  return <CustomerQueueDisplay branchId={branchId} initialData={initialData}/>;
}
