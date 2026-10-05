/** Presentation only. The inventory RPC remains authoritative for quantities and reservations. */
export const movementDescriptions = {
  purchase: { label: "Stock received from a purchase", help: "Use when new stock arrives from a supplier.", note: "Supplier name or delivery receipt number", removes: false },
  opening: { label: "Starting stock", help: "Use when recording stock already on hand for the first time. This adds to the current balance; it does not replace it.", note: "Initial stock count or setup reference", removes: false },
  return: { label: "Unused stock returned", help: "Use when unused items are put back into inventory. For a customer purchase return, record the return in Checkout to keep its history linked.", note: "Where the stock came back from", removes: false },
  usage: { label: "Used for a service or daily work", help: "Use for items already used, such as shampoo or cleaning supplies. Do not record usage again if the service already deducted it.", note: "Service, appointment or reason for use", removes: true },
  waste: { label: "Damaged, expired or lost stock", help: "Use for items that can no longer be used or sold.", note: "What happened, such as expired or damaged", removes: true },
  adjustment: { label: "Extra stock found during a count", help: "Use to add stock found during a physical count. Enter only the extra quantity, not the total counted.", note: "Stock-count reference and explanation", removes: false },
} as const;
export type MovementDisplayType = keyof typeof movementDescriptions;
export function movementPreview(onHand: number | string, quantity: string, type: string) {
  if (!Object.hasOwn(movementDescriptions, type) || !/^\d+(?:\.\d{1,3})?$/.test(quantity)) return null;
  const amount = Number(quantity), current = Number(onHand);
  if (!Number.isFinite(current) || amount <= 0 || amount > 999999999) return null;
  const change = Math.round(amount * 1000) * (movementDescriptions[type as MovementDisplayType].removes ? -1 : 1);
  return { change: change / 1000, after: (Math.round(current * 1000) + change) / 1000 };
}
