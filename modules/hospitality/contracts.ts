import { z } from "zod";
import { parseMoneyToCentavos } from "@/lib/operations";

export const hospitalityRoles = {
  operate: ["owner", "manager", "advisor", "cashier"],
  housekeeping: ["owner", "manager", "advisor", "cashier", "technician"],
  checkIn: ["owner", "manager", "cashier"],
  guestsWrite: ["owner", "manager", "advisor"],
  rooms: ["owner", "manager"],
  financeRead: ["owner", "manager", "advisor", "cashier"],
  financeWrite: ["owner", "manager", "cashier"],
} as const;
export function canHospitality(role: string, capability: keyof typeof hospitalityRoles) {
  return (hospitalityRoles[capability] as readonly string[]).includes(role);
}
export function chargeCentavos(value: string, optional = false): number | null {
  if (optional && !value.trim()) return null;
  const amount = parseMoneyToCentavos(value);
  if (amount === null || amount > 10000000000n) throw new Error("Enter an amount from 0 to 100,000,000 with at most two decimal places.");
  return Number(amount);
}
export const roomInput = z.object({ id: z.union([z.uuid(), z.literal("")]), name: z.string().trim().min(1).max(80), roomType: z.string().trim().max(80), description: z.string().trim().max(1000), capacity: z.coerce.number().int().min(1).max(100), active: z.boolean() });
export const stayPackages = [
  { label: "3 hours", durationMinutes: 180 }, { label: "6 hours", durationMinutes: 360 },
  { label: "12 hours", durationMinutes: 720 }, { label: "1 day", durationMinutes: 1440 },
  { label: "Weekly", durationMinutes: 10080 }, { label: "Monthly", durationMinutes: 43200 },
] as const;
export const roomRateInput = z.object({ id: z.uuid(), label: z.string().trim().min(1).max(80), durationMinutes: z.number().int().refine(n => stayPackages.some(p => p.durationMinutes === n)), priceCentavos: z.number().int().min(1).max(10000000000), extensionHourlyCentavos: z.number().int().min(0).max(10000000000).optional() });
export const roomRatesInput = z.array(roomRateInput).min(1, "Set a price for at least one stay period.").max(6).refine(rates => new Set(rates.map(r => r.durationMinutes)).size === rates.length && new Set(rates.map(r => r.id)).size === rates.length, "Each stay period must appear once.");
export type RoomRate = z.infer<typeof roomRateInput>;
export const checkInInput = z.object({ roomId: z.uuid(), rateId: z.uuid(), ratesVersion: z.coerce.number().int().min(0), guestId: z.union([z.uuid(), z.literal("")]), guestName: z.string().trim().max(160), occupants: z.coerce.number().int().min(1).max(100), notes: z.string().trim().max(2000), requestKey: z.uuid(), tendered: z.string().max(30), method: z.enum(["cash", "gcash", "maya", "bank_transfer", "card", "other"]), reference: z.string().trim().max(200) });
export function cashChange(charge: number, tendered: number) { return Math.max(0, tendered - charge); }
export type Room = { id: string; name: string; room_type: string | null; description: string | null; capacity: number; is_active: boolean; rates: RoomRate[]; rates_version: number };
export type Stay = { id: string; branch_id: string; room_id: string; guest_id: string | null; guest_name_snapshot: string; room_name_snapshot: string; occupants: number; notes: string | null; checked_in_at: string; checked_out_at: string | null; planned_checkout_at: string | null; stay_period_label: string | null };
export type Bill = { id: string; invoice_number: string; status: string; total_centavos: number; paid_centavos: number; balance_centavos: number; customer_name_snapshot: string; external_receipt_number?: string | null };
export function billStatus(bill: Bill | null): string {
  if (!bill) return "No charges recorded";
  if (bill.status === "void") return "Voided";
  if (bill.total_centavos === 0) return "Zero charge";
  if (bill.balance_centavos === 0) return "Paid";
  return bill.paid_centavos > 0 ? "Partially paid" : "Unpaid";
}
export type WorkspaceRow = Record<string, string | number | boolean | null>;
export type HospitalityWorkspace = { occupied: number; cleaning: number; vacant: number; inactive: number; checkIns: number; checkOuts: number; inHouse: number; lowStock?: number; stockItems?: number; finance?: { charges: number; paid: number; outstanding: number; checkedOutDebt: number; collected: number; depositsHeld: number; depositsReceived: number; depositsReturned: number; methods: { method: string; amount: number }[] }; rows: WorkspaceRow[]; rowCount: number; page: number };

export const settlementInput = z.object({ finalPrice: z.string().min(1).max(30), discountType: z.enum(["none", "manual", "card", "pwd", "senior"]), discountCard: z.string().trim().max(80), deposit: z.string().max(30).default("0"), receiptNumber: z.string().trim().max(80), tendered: z.string().max(30), method: z.enum(["cash", "gcash", "maya", "bank_transfer", "card", "other"]), reference: z.string().trim().max(200) });
export type Deposit = { amount_centavos: number; method: string; received_at: string; refunded_at: string | null; refund_method: string | null; refund_reference: string | null };
