import { redirect } from "next/navigation";
export default async function LegacyCheckInsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["room", "guest", "q", "page", "preset", "start", "end"]) if (q[key]) params.set(key, q[key]!);
  if (q.tab === "new" || q.room || q.guest) params.set("dialog", "manual");
  else if (q.tab === "history") params.set("tab", "history");
  redirect(`/dashboard/hospitality/bookings?${params}`);
}
