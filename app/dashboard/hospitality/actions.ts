"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hospitalityContext } from "@/modules/hospitality/runtime";
import { canHospitality, chargeCentavos, checkInInput, settlementInput, roomInput, roomRatesInput } from "@/modules/hospitality/contracts";
import { paymentMethods } from "@/modules/core/payments/payment.service";
import type { HospitalityActionState } from "@/components/hospitality/action-form";
import { reportActionError } from "@/lib/errors/action-error";
const value = (data: FormData, key: string) => String(data.get(key) ?? "");
function failure(error: unknown): HospitalityActionState {
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Review the form details." };
  return { error: reportActionError("hospitality.save", error, "Unable to save. The room, balance or permissions may have changed. Refresh and review the details.") };
}
function done(path: string): never { revalidatePath("/dashboard", "layout"); redirect(path); }
export async function saveRoom(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  try {
    const { db, activeMembership: m } = await hospitalityContext();
    const p = roomInput.parse({ ...Object.fromEntries(data), active: data.get("active") === "on" });
    if (!canHospitality(m.role, "rooms")) return { error: "Room management access is required." };
    const rates = roomRatesInput.parse(JSON.parse(value(data, "rates")));
    const ratesVersion = z.coerce.number().int().min(0).parse(value(data, "ratesVersion"));
    const result = await db.rpc("save_hospitality_room_with_rates", { p_org: m.organizationId, p_branch: m.branchId, p_room: p.id || null, p_name: p.name, p_type: p.roomType, p_description: p.description, p_capacity: p.capacity, p_active: p.active, p_rates: rates, p_expected_version: ratesVersion });
    if (result.error) return { error: result.error.code === "40001" ? "Room rates changed. Close and reopen this form before saving." : result.error.code === "23505" ? "This branch already has a room with that name." : result.error.code === "22023" ? "An occupied room cannot be deactivated or reduced below its current occupants." : failure(result.error).error };
  } catch (error) { return failure(error); }
  done("/dashboard/hospitality/rooms");
}
export async function checkIn(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  let stayId: string;
  try {
    const { db, activeMembership: m } = await hospitalityContext();
    const p = checkInInput.parse(Object.fromEntries(data));
    const settlement = settlementInput.parse(Object.fromEntries(data));
    if (!canHospitality(m.role, "checkIn")) return { error: "Cashier access is required to collect payment and check in." };
    let tendered: number | null;
    try { tendered = chargeCentavos(p.tendered); } catch { return { error: "Enter a valid amount received." }; }
    const result = await db.rpc("check_in_hospitality_shift", { p_cashier: z.uuid("Select the cashier for this shift.").parse(value(data, "cashierStaffId")), p_housekeeper: z.uuid("Select the housekeeper for this shift.").parse(value(data, "housekeeperStaffId")), p_final: chargeCentavos(settlement.finalPrice), p_discount_type: settlement.discountType, p_discount_card: settlement.discountCard, p_deposit: chargeCentavos(settlement.deposit || "0"), p_receipt: settlement.receiptNumber, p_org: m.organizationId, p_branch: m.branchId, p_room: p.roomId, p_rate: p.rateId, p_rates_version: p.ratesVersion, p_tendered: tendered, p_method: p.method, p_reference: p.reference, p_occupants: p.occupants, p_guest_name: p.guestName, p_guest: p.guestId || null, p_notes: p.notes, p_request: p.requestKey });
    if (result.error) return { error: result.error.code === "40001" ? "Room rates or recorded shift details changed. Close this form and review the room and stay before collecting payment." : result.error.code === "55000" ? "This room is being cleaned. Wait until it is marked ready before check-in." : result.error.code === "23505" ? "This room is already occupied. Choose another vacant room." : result.error.code === "22023" ? "Review the selected staff, final price, discount card number and deposit. Payment must cover the final price plus deposit." : failure(result.error).error };
    stayId = result.data;
  } catch (error) { return failure(error); }
  done(`/dashboard/hospitality/stays/${stayId}`);
}
export async function checkOut(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  const stayId = value(data, "stayId");
  try {
    z.uuid().parse(stayId);
    const { db, activeMembership: m } = await hospitalityContext();
    const result = await db.rpc("check_out_hospitality_shift", { p_cashier: z.uuid("Select the cashier for this shift.").parse(value(data, "cashierStaffId")), p_housekeeper: z.uuid("Select the housekeeper for this shift.").parse(value(data, "housekeeperStaffId")), p_confirm_refund: data.get("confirmRefund") === "on", p_refund_method: z.enum(paymentMethods).parse(value(data, "refundMethod") || "cash"), p_refund_reference: z.string().trim().max(200).parse(value(data, "refundReference")), p_org: m.organizationId, p_branch: m.branchId, p_stay: stayId, p_acknowledge_debt: data.get("acknowledgeDebt") === "on" });
    if (result.error) return { error: result.error.code === "40001" ? "Checkout or shift details were already recorded. Close this form and refresh the stay." : result.error.code === "22023" ? "Review the selected staff, confirm the deposit return and acknowledge any outstanding balance before checking out." : failure(result.error).error };
  } catch (error) { return failure(error); }
  done(`/dashboard/hospitality/stays/${stayId}`);
}
export async function addCharge(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  const stayId = value(data, "stayId");
  try {
    const p = z.object({ stayId: z.uuid(), requestKey: z.uuid(), description: z.string().trim().min(1).max(200), quantity: z.coerce.number().int().min(1).max(1000) }).parse(Object.fromEntries(data));
    const { db, activeMembership: m } = await hospitalityContext();
    let amount; try { amount = chargeCentavos(value(data, "amount")); } catch { return { error: "Enter a valid charge with at most two decimal places." }; }
    const result = await db.rpc("add_hospitality_charge", { p_org: m.organizationId, p_branch: m.branchId, p_stay: p.stayId, p_description: p.description, p_quantity: p.quantity, p_unit_centavos: amount, p_request: p.requestKey });
    if (result.error) return failure(result.error);
  } catch (error) { return failure(error); }
  done(`/dashboard/hospitality/stays/${stayId}?tab=charges`);
}
export async function recordPayment(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  const stayId = value(data, "stayId");
  try {
    const p = z.object({ stayId: z.uuid(), requestKey: z.uuid(), method: z.enum(paymentMethods), reference: z.string().trim().max(200), notes: z.string().trim().max(2000), paidDate: z.iso.date() }).parse(Object.fromEntries(data));
    const { db, activeMembership: m } = await hospitalityContext();
    if (!canHospitality(m.role, "financeWrite")) return { error: "Payment recording access is required." };
    const link = await db.from("hospitality_stay_bills").select("invoice_id").eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("stay_id", p.stayId).single();
    if (link.error) return { error: "Record a charge before recording a payment." };
    let amount; try { amount = chargeCentavos(value(data, "amount")); } catch { return { error: "Enter a valid payment amount." }; }
    const result = await db.rpc("record_invoice_collection_with_receipt", { p_receipt_number: z.string().trim().max(80).parse(value(data, "receiptNumber")), p_invoice_id: link.data.invoice_id, p_amount_centavos: amount, p_method: p.method, p_request_key: p.requestKey, p_reference: p.reference, p_notes: p.notes, p_paid_date: p.paidDate, p_currency: m.currency });
    if (result.error) return { error: result.error.code === "22023" ? "Payment must be positive, within the remaining balance, and dated between bill creation and today." : failure(result.error).error };
  } catch (error) { return failure(error); }
  done(`/dashboard/hospitality/stays/${stayId}?tab=charges`);
}
export async function reverseStayPayment(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  const stayId = value(data, "stayId");
  try {
    const p = z.object({ stayId: z.uuid(), paymentId: z.uuid(), reversal: z.enum(["void", "refund"]), reason: z.string().trim().min(3).max(500) }).parse(Object.fromEntries(data));
    const { db, activeMembership: m } = await hospitalityContext();
    if (!canHospitality(m.role, "financeWrite")) return { error: "Payment recording access is required." };
    const link = await db.from("hospitality_stay_bills").select("invoice_id").eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("stay_id", p.stayId).single();
    if (link.error) return failure(link.error);
    const payment = await db.from("payments").select("id,status").eq("id", p.paymentId).eq("invoice_id", link.data.invoice_id).single();
    if (payment.error) return failure(payment.error);
    if (payment.data.status !== (p.reversal === "void" ? "voided" : "refunded")) {
      const result = await db.rpc("reverse_payment", { p_payment_id: p.paymentId, p_action: p.reversal, p_note: p.reason });
      if (result.error) return failure(result.error);
    }
  } catch (error) { return failure(error); }
  done(`/dashboard/hospitality/stays/${stayId}?tab=charges`);
}

export async function markRoomReady(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  try {
    const p = z.object({ roomId: z.uuid(), cleaningStayId: z.uuid() }).parse(Object.fromEntries(data));
    const { db, activeMembership: m } = await hospitalityContext();
    if (!canHospitality(m.role, "housekeeping")) return { error: "Housekeeping access is required." };
    const result = await db.rpc("mark_hospitality_room_ready", { p_org: m.organizationId, p_branch: m.branchId, p_room: p.roomId, p_cleaning_stay: p.cleaningStayId });
    if (result.error) return { error: result.error.code === "40001" || result.error.code === "55000" ? "The room status has changed. Close this form and refresh before marking it ready." : failure(result.error).error };
  } catch (error) { return failure(error); }
  done("/dashboard/hospitality/rooms");
}

export async function extendStay(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  const stayId = value(data, "stayId");
  try {
    const p = settlementInput.parse(Object.fromEntries(data));
    const { db, activeMembership: m } = await hospitalityContext();
    const result = await db.rpc("extend_hospitality_stay", {
      p_org: m.organizationId, p_branch: m.branchId, p_stay: z.uuid().parse(stayId), p_request: z.uuid().parse(value(data, "requestKey")),
      p_expected_end: z.union([z.iso.datetime({ offset: true }), z.literal("")]).parse(value(data, "expectedEnd")) || null,
      p_hours: z.coerce.number().int().min(1).max(720).parse(value(data, "hours")), p_rate: z.union([z.uuid(), z.literal("")]).parse(value(data, "rateId")) || null,
      p_rates_version: z.coerce.number().int().min(0).parse(value(data, "ratesVersion")), p_final: chargeCentavos(p.finalPrice), p_discount_type: p.discountType, p_discount_card: p.discountCard,
      p_tendered: chargeCentavos(p.tendered), p_method: p.method, p_reference: p.reference, p_receipt: p.receiptNumber,
    });
    if (result.error) return { error: result.error.code === "40001" ? "The stay end or room rates changed. Close and reopen this form before collecting payment." : result.error.code === "22023" ? "Review the hours, final price, discount details and payment. An hourly extension price must be configured in Rooms." : result.error.code === "55000" ? "This stay has already checked out." : failure(result.error).error };
  } catch (error) { return failure(error); }
  done(`/dashboard/hospitality/stays/${stayId}?tab=charges`);
}
export async function saveReceipt(_state: HospitalityActionState, data: FormData): Promise<HospitalityActionState> {
  const stayId = value(data, "stayId");
  try {
    z.uuid().parse(stayId);
    const { db, activeMembership: m } = await hospitalityContext();
    const link = await db.from("hospitality_stay_bills").select("invoice_id").eq("organization_id", m.organizationId).eq("branch_id", m.branchId).eq("stay_id", stayId).single();
    if (link.error) return failure(link.error);
    const result = await db.rpc("set_invoice_external_receipt", { p_invoice: link.data.invoice_id, p_receipt: z.string().trim().max(80).parse(value(data, "receiptNumber")) });
    if (result.error) return failure(result.error);
  } catch (error) { return failure(error); }
  done(`/dashboard/hospitality/stays/${stayId}?tab=charges`);
}
