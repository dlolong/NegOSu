import { notFound } from "next/navigation";

// Retired public entry point. Queue access now requires a reservation token.
export default function RetiredPublicQueuePage() {
  notFound();
}
