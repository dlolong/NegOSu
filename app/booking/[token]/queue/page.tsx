import { cache } from "react";
import { notFound } from "next/navigation";
import { CustomerQueueDisplay } from "@/components/customer-queue-display";
import { loadReservationQueue } from "@/lib/reservation-queue";
import { QueueDisplayError } from "@/lib/queue-display-service";
import { createPublicClient } from "@/lib/supabase/public";
import { businessMetadata } from "@/modules/platform/business-branding";

export const dynamic = "force-dynamic";
const loadQueue = cache(async (token: string) => {
  try { return await loadReservationQueue(token, createPublicClient()); }
  catch (error) {
    if (error instanceof QueueDisplayError && error.status !== 503) notFound();
    throw new Error("Unable to load your reservation queue. Please try again.");
  }
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const queue = await loadQueue((await params).token);
  return { ...businessMetadata(queue.organizationName, queue.logoUrl, "Reservation queue"), robots: { index: false, follow: false, nocache: true } };
}

export default async function ReservationQueuePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const queue = await loadQueue(token);
  return <CustomerQueueDisplay key={token} reservationToken={token} initialData={queue}/>;
}
