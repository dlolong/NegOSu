import { redirect } from "next/navigation";

export default async function LegacyInventoryReport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") query.set(key, value);
  }
  redirect(`/dashboard/inventory/consumption?${query}`);
}
