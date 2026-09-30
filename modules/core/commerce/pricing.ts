import { parseMoneyToCentavos } from "@/lib/operations";

/** Match the catalog RPC limit before converting exact bigint money to JSON-safe numbers. */
export function parseCatalogPrice(value: string): number | null {
  const amount = parseMoneyToCentavos(value);
  return amount !== null && amount <= 10_000_000_000n ? Number(amount) : null;
}
